"""
AETHER-Swarm P2P Client
========================
Integration glue connecting the AirLLM inference bridge to the AETHER-Swarm
transport layer. Handles the full send/receive lifecycle:

  SEND: Inference bridge → extract KV-cache → compress → serialize → POST /kv/stream
  RECV: Listen for payloads → deserialize → dequantize → inject into local VRAM

DEPENDENCY NOTICE:
  This module REQUIRES a functional AirLLM inference bridge (air_llm/inference_bridge.py).
  The inference bridge is responsible for:
    1. Loading the model and running forward passes.
    2. Exposing raw KV-cache tensors (keys, values) after generation.
    3. Accepting injected KV-cache states for continued generation.
  Without these capabilities, this client has nothing to send or receive.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

try:
    import requests
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False

from .kv_compressor import (
    compress_kv_cache,
    decompress_kv_cache,
    CompressionResult,
    DEFAULT_BLOCK_SIZE,
    DEFAULT_PRUNING_THETA,
)
from .serializer import serialize_payload, deserialize_payload
from .protocol import SequenceTracker, compute_sender_hash

logger = logging.getLogger("aether_swarm.p2p_client")


@dataclass
class NodeIdentity:
    """Identity of a P2P node in the AETHER-Swarm network."""
    node_id: str
    public_key: bytes       # 32-byte Ed25519 public key
    signing_key: bytes      # 32-byte Ed25519 signing seed
    gateway_url: str        # e.g. "https://node-a.hf.space"


@dataclass
class TransferResult:
    """Result of a KV-cache transfer."""
    transfer_id: str
    success: bool
    bytes_sent: int
    compression_ratio: float
    pruned_blocks: int
    total_blocks: int
    tier_distribution: dict
    latency_ms: float
    error: Optional[str] = None


class AetherSwarmClient:
    """
    High-level client for sending and receiving compressed KV-cache states
    across the P2P network via the AETHER-Swarm core engine.

    Usage:
        # On the sending node (e.g., Researcher agent):
        client = AetherSwarmClient(my_identity)
        result = client.send_kv_cache(
            keys=kv_keys,          # from inference bridge
            values=kv_values,      # from inference bridge
            query_centroid=q,      # current query embedding
            recipient_id="node-b",
            engine_url="http://localhost:5010",
        )

        # On the receiving node (e.g., Writer agent):
        blocks, pruned = client.receive_kv_cache(
            engine_url="http://localhost:5010",
            transfer_id=result.transfer_id,
        )
        # Inject blocks into local model via inference bridge
    """

    def __init__(self, identity: NodeIdentity):
        if not _HAS_REQUESTS:
            raise ImportError(
                "The 'requests' library is required for P2P communication. "
                "Install via: pip install requests"
            )
        self.identity = identity
        self.sender_hash = compute_sender_hash(identity.public_key)
        self._sequence_num = 0
        self._recv_tracker = SequenceTracker()

    def _next_sequence(self) -> int:
        """Get the next monotonically increasing sequence number."""
        self._sequence_num += 1
        return self._sequence_num

    def send_kv_cache(
        self,
        keys: np.ndarray,
        values: np.ndarray,
        query_centroid: np.ndarray,
        recipient_id: str,
        engine_url: str,
        block_size: int = DEFAULT_BLOCK_SIZE,
        theta: float = DEFAULT_PRUNING_THETA,
        timeout_seconds: float = 30.0,
    ) -> TransferResult:
        """
        Full send pipeline:
        1. Compress KV-cache (geometric prune + quantize).
        2. Serialize into binary wire frame.
        3. Offer to engine → stream binary → check result.

        REQUIRES: keys/values extracted from the AirLLM inference bridge.
        """
        t_start = time.time()

        # Stage 1: Compress
        logger.info(f"Compressing KV-cache: {keys.shape[0]} tokens, dim={keys.shape[1]}")
        result = compress_kv_cache(keys, values, query_centroid, block_size, theta)

        # Stage 2: Serialize
        seq = self._next_sequence()
        frame_bytes = serialize_payload(
            result,
            sender_public_key=self.identity.public_key,
            sequence_num=seq,
            signing_key_bytes=self.identity.signing_key,
        )

        # Compute compression ratio
        raw_size = keys.nbytes + values.nbytes
        compressed_size = len(frame_bytes)
        compression_ratio = raw_size / max(compressed_size, 1)

        logger.info(
            f"Compressed: {raw_size} → {compressed_size} bytes "
            f"({compression_ratio:.1f}× ratio) | "
            f"Pruned {len(result.pruned_indices)}/{result.total_blocks} blocks | "
            f"Tiers: {result.tier_distribution}"
        )

        # Stage 3a: Offer
        payload_sha256 = hashlib.sha256(frame_bytes).hexdigest()

        offer_resp = requests.post(
            f"{engine_url}/kv/offer",
            json={
                "sender_id": self.identity.node_id,
                "recipient_id": recipient_id,
                "sender_hash": self.sender_hash.hex(),
                "sequence_num": seq,
                "payload_sha256": payload_sha256,
                "payload_size_bytes": len(frame_bytes),
            },
            timeout=timeout_seconds,
        )

        if not offer_resp.ok:
            return TransferResult(
                transfer_id="",
                success=False,
                bytes_sent=0,
                compression_ratio=compression_ratio,
                pruned_blocks=len(result.pruned_indices),
                total_blocks=result.total_blocks,
                tier_distribution=result.tier_distribution,
                latency_ms=(time.time() - t_start) * 1000,
                error=f"Offer rejected: {offer_resp.text}",
            )

        offer_data = offer_resp.json()
        transfer_id = offer_data["transfer_id"]

        # Stage 3b: Stream binary payload
        stream_resp = requests.post(
            f"{engine_url}/kv/stream",
            data=frame_bytes,
            headers={
                "Content-Type": "application/octet-stream",
                "X-Transfer-Id": transfer_id,
            },
            timeout=timeout_seconds,
        )

        t_end = time.time()
        latency_ms = (t_end - t_start) * 1000

        if not stream_resp.ok:
            return TransferResult(
                transfer_id=transfer_id,
                success=False,
                bytes_sent=len(frame_bytes),
                compression_ratio=compression_ratio,
                pruned_blocks=len(result.pruned_indices),
                total_blocks=result.total_blocks,
                tier_distribution=result.tier_distribution,
                latency_ms=latency_ms,
                error=f"Stream failed: {stream_resp.text}",
            )

        logger.info(
            f"Transfer {transfer_id} complete: {len(frame_bytes)} bytes in {latency_ms:.0f}ms"
        )

        return TransferResult(
            transfer_id=transfer_id,
            success=True,
            bytes_sent=len(frame_bytes),
            compression_ratio=compression_ratio,
            pruned_blocks=len(result.pruned_indices),
            total_blocks=result.total_blocks,
            tier_distribution=result.tier_distribution,
            latency_ms=latency_ms,
        )

    def acknowledge_transfer(
        self,
        engine_url: str,
        transfer_id: str,
        success: bool = True,
        failed_blocks: Optional[List[int]] = None,
    ):
        """Send ACK or NACK for a received transfer."""
        requests.post(
            f"{engine_url}/kv/ack",
            json={
                "transfer_id": transfer_id,
                "success": success,
                "failed_blocks": failed_blocks or [],
            },
        )
