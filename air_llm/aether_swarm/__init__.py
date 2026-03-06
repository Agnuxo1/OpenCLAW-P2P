"""
AETHER-Swarm — KV-Cache Routing for P2P Agent Swarms
=====================================================
Mathematically compressed KV-cache streaming across the OpenCLAW P2P network.

DEPENDENCY NOTICE:
  This entire module REQUIRES a functional AirLLM inference bridge
  (air_llm/inference_bridge.py) to extract raw KV-cache states from the
  local model. Without the inference layer, there are no KV-cache tensors
  to compress or transmit. AETHER-Swarm is a pure compression + transport
  layer that sits ON TOP of the inference bridge.

Components:
  - kv_compressor: Geometric pruning (σ²_B) + 3-tier angular quantization (c_B)
  - protocol:      Binary wire format with CRC-32/64, Ed25519, sequence numbering
  - serializer:    Pack/unpack between QuantizedBlocks and wire frames

References:
  - KIVI (ICML 2024): Asymmetric per-channel/per-token quantization
  - KVQuant (2024):   Outlier isolation, <0.1 perplexity degradation at 3-bit
  - GEAR (NeurIPS 2024): Low-rank SVD residual error correction
"""

from .kv_compressor import (
    # Data classes
    KVBlock,
    QuantizedBlock,
    QuantTier,
    CompressionResult,
    # Stage A — Geometric Pruning
    partition_kv_cache,
    compute_block_variance,
    compute_cauchy_schwarz_bound,
    geometric_prune,
    # Stage B — Quantization
    compute_angular_coherence,
    classify_quant_tier,
    isolate_outliers,
    compute_gear_residual,
    reconstruct_with_gear,
    quantize_block,
    dequantize_block,
    # Full pipeline
    compress_kv_cache,
    decompress_kv_cache,
    # Constants
    DEFAULT_BLOCK_SIZE,
    DEFAULT_PRUNING_THETA,
    COHERENCE_THRESHOLD_HIGH,
    COHERENCE_THRESHOLD_MEDIUM,
)

from .protocol import (
    AetherFrame,
    FrameHeader,
    BlockManifestEntry,
    FrameValidationError,
    SequenceTracker,
    build_frame,
    parse_frame,
    verify_block_crcs,
    crc64_ecma,
    compute_sender_hash,
)

from .serializer import (
    serialize_payload,
    deserialize_payload,
    serialize_quantized_block,
    deserialize_quantized_block,
)

__all__ = [
    # Core data types
    "KVBlock", "QuantizedBlock", "QuantTier", "CompressionResult",
    # Stage A
    "partition_kv_cache", "compute_block_variance",
    "compute_cauchy_schwarz_bound", "geometric_prune",
    # Stage B
    "compute_angular_coherence", "classify_quant_tier",
    "isolate_outliers", "compute_gear_residual", "reconstruct_with_gear",
    "quantize_block", "dequantize_block",
    # Pipeline
    "compress_kv_cache", "decompress_kv_cache",
    # Protocol
    "AetherFrame", "FrameHeader", "BlockManifestEntry",
    "FrameValidationError", "SequenceTracker",
    "build_frame", "parse_frame", "verify_block_crcs",
    "crc64_ecma", "compute_sender_hash",
    # Serializer
    "serialize_payload", "deserialize_payload",
    "serialize_quantized_block", "deserialize_quantized_block",
    # Constants
    "DEFAULT_BLOCK_SIZE", "DEFAULT_PRUNING_THETA",
    "COHERENCE_THRESHOLD_HIGH", "COHERENCE_THRESHOLD_MEDIUM",
]
