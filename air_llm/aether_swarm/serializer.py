"""
AETHER-Swarm KV-Cache Serializer
==================================
Bridges the mathematical compression layer (kv_compressor) and the binary
wire protocol (protocol) — packs QuantizedBlocks into wire frames and
unpacks received frames back into QuantizedBlocks for dequantization.

DEPENDENCY NOTICE:
  This module layers on top of the AirLLM inference bridge (air_llm/inference_bridge.py).
  Without the inference layer producing raw KV-cache states, there is nothing to serialize.
"""

from __future__ import annotations

import struct
from typing import List, Optional, Tuple

import numpy as np

from .kv_compressor import (
    QuantizedBlock,
    QuantTier,
    CompressionResult,
)
from .protocol import (
    build_frame,
    parse_frame,
    verify_block_crcs,
    FrameValidationError,
    SequenceTracker,
    DTYPE_TAG_MAP,
    DTYPE_TAG_REVERSE,
    unpack_shape,
)


# ── Block Serialization ───────────────────────────────────────────────────────

# Sub-header for each block's auxiliary data (scales, zeros, outliers, GEAR residual)
# Format: flags(1B) + aux_len(4B)
# Flags: bit0=has_scales, bit1=has_outliers, bit2=has_gear_residual
BLOCK_AUX_HEADER_FMT = '!BI'
BLOCK_AUX_HEADER_SIZE = struct.calcsize(BLOCK_AUX_HEADER_FMT)


def _serialize_ndarray(arr: Optional[np.ndarray]) -> bytes:
    """Serialize a numpy array to bytes with shape prefix."""
    if arr is None or arr.size == 0:
        return struct.pack('!I', 0)  # length = 0

    raw = arr.astype(np.float32).tobytes()
    ndim = len(arr.shape)
    # Pack: ndim(4B) + shape(4B each) + data
    header = struct.pack('!I', ndim)
    for dim in arr.shape:
        header += struct.pack('!I', dim)
    return struct.pack('!I', len(header) + len(raw)) + header + raw


def _deserialize_ndarray(data: bytes, offset: int) -> Tuple[Optional[np.ndarray], int]:
    """Deserialize a numpy array from bytes. Returns (array, new_offset)."""
    total_len = struct.unpack('!I', data[offset:offset + 4])[0]
    offset += 4

    if total_len == 0:
        return None, offset

    block = data[offset:offset + total_len]
    offset += total_len

    ndim = struct.unpack('!I', block[0:4])[0]
    shape = []
    pos = 4
    for _ in range(ndim):
        shape.append(struct.unpack('!I', block[pos:pos + 4])[0])
        pos += 4

    arr_data = block[pos:]
    arr = np.frombuffer(arr_data, dtype=np.float32).reshape(shape)
    return arr.copy(), offset


def serialize_quantized_block(qblock: QuantizedBlock) -> Tuple[str, Tuple[int, int], bytes]:
    """
    Serialize a single QuantizedBlock into raw bytes.

    Returns:
        (dtype_tag_str, (rows, cols), raw_bytes)
    """
    # Main quantized tensor data
    keys_bytes = qblock.keys_quantized.tobytes()
    values_bytes = qblock.values_quantized.tobytes()

    # Shape from keys
    if qblock.keys_dtype_tag == "int4":
        # Packed shape — rows are halved due to nibble packing
        rows = qblock.keys_quantized.shape[0]
        cols = qblock.keys_quantized.shape[1]
    else:
        rows, cols = qblock.keys_quantized.shape

    # Build auxiliary data
    flags = 0
    aux_parts = []

    # Scales and zeros
    if qblock.keys_scales is not None:
        flags |= 0x01
        aux_parts.append(_serialize_ndarray(qblock.keys_scales))
        aux_parts.append(_serialize_ndarray(qblock.keys_zeros))
        aux_parts.append(_serialize_ndarray(qblock.values_scales))
        aux_parts.append(_serialize_ndarray(qblock.values_zeros))

    # Outlier data
    if qblock.keys_outlier_indices is not None and len(qblock.keys_outlier_indices) > 0:
        flags |= 0x02
        aux_parts.append(_serialize_ndarray(qblock.keys_outlier_indices.astype(np.float32)))
        aux_parts.append(_serialize_ndarray(qblock.keys_outlier_values.astype(np.float32)))
        aux_parts.append(_serialize_ndarray(qblock.values_outlier_indices.astype(np.float32)))
        aux_parts.append(_serialize_ndarray(qblock.values_outlier_values.astype(np.float32)))

    # GEAR residual
    if qblock.keys_residual_U is not None:
        flags |= 0x04
        aux_parts.append(_serialize_ndarray(qblock.keys_residual_U))
        aux_parts.append(_serialize_ndarray(qblock.keys_residual_S))
        aux_parts.append(_serialize_ndarray(qblock.keys_residual_Vt))
        aux_parts.append(_serialize_ndarray(qblock.values_residual_U))
        aux_parts.append(_serialize_ndarray(qblock.values_residual_S))
        aux_parts.append(_serialize_ndarray(qblock.values_residual_Vt))

    aux_data = b''.join(aux_parts)
    aux_header = struct.pack(BLOCK_AUX_HEADER_FMT, flags, len(aux_data))

    # Coherence as float32
    coherence_bytes = struct.pack('!f', qblock.coherence)

    # Tier tag
    tier_byte = struct.pack('!B', list(QuantTier).index(qblock.tier))

    # Pack: tier(1B) + coherence(4B) + keys_len(4B) + keys + values_len(4B) + values + aux_header + aux_data
    raw = (
        tier_byte
        + coherence_bytes
        + struct.pack('!I', len(keys_bytes)) + keys_bytes
        + struct.pack('!I', len(values_bytes)) + values_bytes
        + aux_header + aux_data
    )

    return qblock.keys_dtype_tag, (rows, cols), raw


def deserialize_quantized_block(
    block_idx: int,
    dtype_tag_str: str,
    shape: Tuple[int, int],
    raw: bytes,
) -> QuantizedBlock:
    """
    Deserialize raw bytes back into a QuantizedBlock.
    """
    offset = 0

    # Tier
    tier_idx = struct.unpack('!B', raw[offset:offset + 1])[0]
    tier = list(QuantTier)[tier_idx]
    offset += 1

    # Coherence
    coherence = struct.unpack('!f', raw[offset:offset + 4])[0]
    offset += 4

    # Keys
    keys_len = struct.unpack('!I', raw[offset:offset + 4])[0]
    offset += 4
    keys_raw = raw[offset:offset + keys_len]
    offset += keys_len

    # Values
    values_len = struct.unpack('!I', raw[offset:offset + 4])[0]
    offset += 4
    values_raw = raw[offset:offset + values_len]
    offset += values_len

    # Determine numpy dtype for the quantized data
    if dtype_tag_str == "float16":
        np_dtype = np.float16
    else:
        np_dtype = np.uint8

    rows, cols = shape
    keys_quantized = np.frombuffer(keys_raw, dtype=np_dtype).reshape(rows, cols).copy()
    values_quantized = np.frombuffer(values_raw, dtype=np_dtype).reshape(-1, cols).copy()

    # Aux header
    flags, aux_len = struct.unpack(BLOCK_AUX_HEADER_FMT, raw[offset:offset + BLOCK_AUX_HEADER_SIZE])
    offset += BLOCK_AUX_HEADER_SIZE

    keys_scales = keys_zeros = values_scales = values_zeros = None
    keys_out_idx = keys_out_val = values_out_idx = values_out_val = None
    k_U = k_S = k_Vt = v_U = v_S = v_Vt = None

    if flags & 0x01:
        keys_scales, offset = _deserialize_ndarray(raw, offset)
        keys_zeros, offset = _deserialize_ndarray(raw, offset)
        values_scales, offset = _deserialize_ndarray(raw, offset)
        values_zeros, offset = _deserialize_ndarray(raw, offset)

    if flags & 0x02:
        keys_out_idx, offset = _deserialize_ndarray(raw, offset)
        keys_out_val, offset = _deserialize_ndarray(raw, offset)
        values_out_idx, offset = _deserialize_ndarray(raw, offset)
        values_out_val, offset = _deserialize_ndarray(raw, offset)
        # Convert back from float32 to proper types
        if keys_out_idx is not None:
            keys_out_idx = keys_out_idx.astype(np.intp)
        if values_out_idx is not None:
            values_out_idx = values_out_idx.astype(np.intp)

    if flags & 0x04:
        k_U, offset = _deserialize_ndarray(raw, offset)
        k_S, offset = _deserialize_ndarray(raw, offset)
        k_Vt, offset = _deserialize_ndarray(raw, offset)
        v_U, offset = _deserialize_ndarray(raw, offset)
        v_S, offset = _deserialize_ndarray(raw, offset)
        v_Vt, offset = _deserialize_ndarray(raw, offset)

    return QuantizedBlock(
        block_idx=block_idx,
        tier=tier,
        coherence=coherence,
        keys_quantized=keys_quantized,
        values_quantized=values_quantized,
        keys_dtype_tag=dtype_tag_str,
        values_dtype_tag=dtype_tag_str,
        keys_scales=keys_scales,
        keys_zeros=keys_zeros,
        values_scales=values_scales,
        values_zeros=values_zeros,
        keys_outlier_indices=keys_out_idx,
        keys_outlier_values=keys_out_val,
        values_outlier_indices=values_out_idx,
        values_outlier_values=values_out_val,
        keys_residual_U=k_U,
        keys_residual_S=k_S,
        keys_residual_Vt=k_Vt,
        values_residual_U=v_U,
        values_residual_S=v_S,
        values_residual_Vt=v_Vt,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# High-Level API
# ═══════════════════════════════════════════════════════════════════════════════

def serialize_payload(
    result: CompressionResult,
    sender_public_key: bytes,
    sequence_num: int,
    signing_key_bytes: Optional[bytes] = None,
) -> bytes:
    """
    Serialize a full CompressionResult into a wire-ready AETHER-Swarm frame.

    Pipeline: QuantizedBlocks → per-block bytes → wire protocol frame.

    Args:
        result: Output of compress_kv_cache().
        sender_public_key: 32-byte Ed25519 public key.
        sequence_num: Monotonically increasing sequence number.
        signing_key_bytes: Optional 32-byte Ed25519 seed for signing.

    Returns:
        Complete binary frame ready for P2P transmission.
    """
    block_payloads = []

    for qblock in result.active_blocks:
        dtype_str, shape, raw = serialize_quantized_block(qblock)
        block_payloads.append((qblock.block_idx, dtype_str, shape, raw))

    return build_frame(
        block_payloads=block_payloads,
        sender_public_key=sender_public_key,
        sequence_num=sequence_num,
        signing_key_bytes=signing_key_bytes,
    )


def deserialize_payload(
    raw_frame: bytes,
    expected_sender_pubkey: Optional[bytes] = None,
    sequence_tracker: Optional[SequenceTracker] = None,
) -> List[QuantizedBlock]:
    """
    Deserialize a wire frame back into QuantizedBlocks.

    Validation order:
    1. Frame CRC-64 verification.
    2. Ed25519 signature verification (if pubkey provided).
    3. Sequence number validation (if tracker provided).
    4. Per-block CRC-32 verification.

    Raises FrameValidationError on any integrity failure.
    """
    frame = parse_frame(raw_frame, expected_sender_pubkey, sequence_tracker)

    # Split payload into per-block chunks
    # We need to re-parse to figure out block boundaries
    # Each block's data is serialized contiguously; we track offsets via manifest
    block_data_list = []
    offset = 0

    # Since we don't store per-block lengths in the manifest, we need to
    # extract them by parsing the tier+coherence+keys_len+values_len+aux from each block
    payload = frame.payload
    blocks = []

    for entry in frame.manifest:
        dtype_str = DTYPE_TAG_REVERSE[entry.dtype_tag]
        shape = unpack_shape(entry.shape_packed)

        # Find the end of this block's data by parsing its structure
        block_start = offset

        # tier(1B) + coherence(4B)
        pos = offset + 5

        # keys_len(4B) + keys_data
        keys_len = struct.unpack('!I', payload[pos:pos + 4])[0]
        pos += 4 + keys_len

        # values_len(4B) + values_data
        values_len = struct.unpack('!I', payload[pos:pos + 4])[0]
        pos += 4 + values_len

        # aux_header(5B) + aux_data
        flags, aux_len = struct.unpack(BLOCK_AUX_HEADER_FMT, payload[pos:pos + BLOCK_AUX_HEADER_SIZE])
        pos += BLOCK_AUX_HEADER_SIZE + aux_len

        block_raw = payload[block_start:pos]
        block_data_list.append(block_raw)

        offset = pos

    # Verify per-block CRCs
    failed_blocks = verify_block_crcs(frame, block_data_list)
    if failed_blocks:
        raise FrameValidationError(
            f"CRC-32 verification failed for blocks: {failed_blocks}. "
            f"Selective retransmission required."
        )

    # Deserialize each block
    for entry, block_raw in zip(frame.manifest, block_data_list):
        dtype_str = DTYPE_TAG_REVERSE[entry.dtype_tag]
        shape = unpack_shape(entry.shape_packed)
        qblock = deserialize_quantized_block(entry.block_idx, dtype_str, shape, block_raw)
        blocks.append(qblock)

    return blocks
