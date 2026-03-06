"""
AETHER-Swarm KV-Cache Compressor
=================================
Two-stage mathematical compression pipeline for P2P KV-cache streaming.

Stage A — Geometric Pruning (σ²_B variance + Cauchy-Schwarz bound)
Stage B — Dynamic Asymmetric Quantization (3-tier, KIVI/KVQuant/GEAR-informed)

DEPENDENCY NOTICE:
  This module REQUIRES a functional AirLLM inference bridge (air_llm/inference_bridge.py)
  to extract raw KV-cache states from the local model. Without the inference layer,
  there are no KV-cache tensors to compress. This module is a pure mathematical
  compression/decompression layer that sits ON TOP of the inference bridge — it does
  NOT perform model loading, tokenization, or forward passes itself.

References:
  - KIVI: Liu et al., "A Tuning-Free Asymmetric 2bit Quantization for KV Cache", ICML 2024
  - KVQuant: Hooper et al., "Towards 10 Million Context Length LLM Inference", arXiv 2024
  - GEAR: Kang et al., "An Efficient KV Cache Compression Recipe", NeurIPS 2024
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Tuple, Optional

import numpy as np


# ── Constants ──────────────────────────────────────────────────────────────────

DEFAULT_BLOCK_SIZE = 64          # tokens per KV block
DEFAULT_PRUNING_THETA = 0.01    # Cauchy-Schwarz relevance threshold
OUTLIER_SIGMA_FACTOR = 6.0      # 6σ outlier isolation (KVQuant)
GEAR_RESIDUAL_RANK = 2          # Low-rank SVD correction rank (GEAR)
INT4_GROUP_SIZE = 128           # Group quantization granularity for INT4


class QuantTier(Enum):
    """Three-tier quantization classification based on angular coherence."""
    HIGH   = "INT4"   # c_B >= 0.95 → 4× compression
    MEDIUM = "INT8"   # 0.85 <= c_B < 0.95 → 2× compression
    LOW    = "FP16"   # c_B < 0.85 → no quantization


# Thresholds derived from KIVI (ICML 2024) and KVQuant (2024).
# KIVI: per-channel INT2 maintains near-lossless quality (2.6× peak memory reduction).
# KVQuant: <0.1 perplexity degradation at 3-bit.
# We use INT4 (not INT2) for HIGH tier as safety margin for P2P transmission noise.
COHERENCE_THRESHOLD_HIGH   = 0.95
COHERENCE_THRESHOLD_MEDIUM = 0.85


@dataclass
class KVBlock:
    """A single block from the KV-cache partition."""
    block_idx: int
    keys: np.ndarray          # shape: (b, D)  — b tokens, D embedding dim
    values: np.ndarray        # shape: (b, D)

    @property
    def block_size(self) -> int:
        return self.keys.shape[0]

    @property
    def embed_dim(self) -> int:
        return self.keys.shape[1]


@dataclass
class QuantizedBlock:
    """A block after the full quantization pipeline."""
    block_idx: int
    tier: QuantTier
    coherence: float

    # Quantized dense payload (INT4/INT8 packed as uint8, or FP16 raw)
    keys_quantized: np.ndarray
    values_quantized: np.ndarray
    keys_dtype_tag: str           # "int4", "int8", or "float16"
    values_dtype_tag: str

    # Per-channel scale/zero for dequantization
    keys_scales: Optional[np.ndarray] = None
    keys_zeros: Optional[np.ndarray] = None
    values_scales: Optional[np.ndarray] = None
    values_zeros: Optional[np.ndarray] = None

    # Outlier sparse correction (KVQuant dense-and-sparse)
    keys_outlier_indices: Optional[np.ndarray] = None
    keys_outlier_values: Optional[np.ndarray] = None
    values_outlier_indices: Optional[np.ndarray] = None
    values_outlier_values: Optional[np.ndarray] = None

    # Low-rank residual correction (GEAR)
    keys_residual_U: Optional[np.ndarray] = None
    keys_residual_S: Optional[np.ndarray] = None
    keys_residual_Vt: Optional[np.ndarray] = None
    values_residual_U: Optional[np.ndarray] = None
    values_residual_S: Optional[np.ndarray] = None
    values_residual_Vt: Optional[np.ndarray] = None


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE A — Geometric Pruning
# ═══════════════════════════════════════════════════════════════════════════════

def partition_kv_cache(
    keys: np.ndarray,
    values: np.ndarray,
    block_size: int = DEFAULT_BLOCK_SIZE,
) -> List[KVBlock]:
    """
    Partition a full KV-cache into contiguous blocks of size `block_size`.

    Args:
        keys:   (N, D) array — full key cache for a sequence of N tokens.
        values: (N, D) array — full value cache.
        block_size: Number of tokens per block.

    Returns:
        List of KVBlock instances.
    """
    N = keys.shape[0]
    blocks = []
    for j, start in enumerate(range(0, N, block_size)):
        end = min(start + block_size, N)
        blocks.append(KVBlock(
            block_idx=j,
            keys=keys[start:end].copy(),
            values=values[start:end].copy(),
        ))
    return blocks


def compute_block_variance(block: KVBlock) -> float:
    """
    Compute the spatial variance σ²_B for a KV block.

    σ²_B = (1/b) Σ ‖k_i - μ_B‖² - [(1/b) Σ ‖k_i - μ_B‖]²

    This measures geometric dispersion of key vectors within the block.
    High variance → keys point in diverse directions → likely relevant.
    Low variance → keys are redundant / uninformative for the query.
    """
    K = block.keys  # (b, D)
    b = K.shape[0]

    mu_B = K.mean(axis=0)                              # (D,)
    diffs = K - mu_B                                    # (b, D)
    norms = np.linalg.norm(diffs, axis=1)               # (b,)

    mean_of_squared_norms = np.mean(norms ** 2)         # E[‖k - μ‖²]
    squared_mean_of_norms = np.mean(norms) ** 2         # [E[‖k - μ‖]]²

    sigma_sq = mean_of_squared_norms - squared_mean_of_norms
    return float(sigma_sq)


def compute_cauchy_schwarz_bound(
    block: KVBlock,
    query_centroid: np.ndarray,
) -> float:
    """
    Compute the Cauchy-Schwarz upper bound of block B_j w.r.t. the query manifold.

    bound(B_j, Q) = max_i |⟨k_i, q⟩| / (‖k_i‖ · ‖q‖)

    This represents the maximum possible cosine similarity between any key
    in the block and the query centroid. If this upper bound is below θ,
    no key in the block can be relevant, so the entire block is prunable.
    """
    K = block.keys  # (b, D)
    q = query_centroid  # (D,)

    q_norm = np.linalg.norm(q)
    if q_norm < 1e-12:
        return 0.0

    k_norms = np.linalg.norm(K, axis=1)                # (b,)
    dots = K @ q                                        # (b,)

    # Avoid division by zero for degenerate keys
    safe_norms = np.maximum(k_norms * q_norm, 1e-12)
    cosines = np.abs(dots) / safe_norms                 # (b,)

    return float(np.max(cosines))


def geometric_prune(
    blocks: List[KVBlock],
    query_centroid: np.ndarray,
    theta: float = DEFAULT_PRUNING_THETA,
) -> Tuple[List[KVBlock], List[int]]:
    """
    Stage A: Geometric Pruning.

    Drops entire KV blocks whose maximum Cauchy-Schwarz upper bound
    w.r.t. the query manifold falls below relevance threshold θ.

    Reduces transmission from O(N) to O(k·b) where k = surviving blocks.

    Args:
        blocks: List of KVBlock from partition_kv_cache().
        query_centroid: (D,) centroid of the current query manifold.
        theta: Relevance threshold. Blocks with bound < θ are pruned.

    Returns:
        (surviving_blocks, pruned_indices)
    """
    surviving = []
    pruned_indices = []

    for block in blocks:
        bound = compute_cauchy_schwarz_bound(block, query_centroid)
        if bound >= theta:
            surviving.append(block)
        else:
            pruned_indices.append(block.block_idx)

    return surviving, pruned_indices


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE B — Dynamic Asymmetric Quantization
# ═══════════════════════════════════════════════════════════════════════════════

def compute_angular_coherence(block: KVBlock) -> float:
    """
    Compute the angular concentration c_B for a KV block.

    c_B = (1/b) Σ (k_i · μ_B) / (‖k_i‖ · ‖μ_B‖)

    High c_B (≥0.95) → keys are tightly clustered directionally → safe for INT4.
    Medium c_B (0.85–0.95) → moderate spread → INT8 is safe.
    Low c_B (<0.85) → high angular diversity / outlier-heavy → keep FP16.
    """
    K = block.keys  # (b, D)
    mu_B = K.mean(axis=0)
    mu_norm = np.linalg.norm(mu_B)

    if mu_norm < 1e-12:
        return 0.0

    k_norms = np.linalg.norm(K, axis=1)
    dots = K @ mu_B

    safe_denoms = np.maximum(k_norms * mu_norm, 1e-12)
    cosines = dots / safe_denoms

    return float(np.mean(cosines))


def classify_quant_tier(coherence: float) -> QuantTier:
    """Classify a block into a quantization tier based on angular coherence."""
    if coherence >= COHERENCE_THRESHOLD_HIGH:
        return QuantTier.HIGH
    elif coherence >= COHERENCE_THRESHOLD_MEDIUM:
        return QuantTier.MEDIUM
    else:
        return QuantTier.LOW


# ── B.3 Outlier Isolation (Dense-and-Sparse Decomposition) ────────────────────

def isolate_outliers(
    tensor: np.ndarray,
    sigma_factor: float = OUTLIER_SIGMA_FACTOR,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Per KVQuant's per-vector dense-and-sparse method:
    1. Compute per-channel robust dispersion via Median Absolute Deviation (MAD).
    2. Identify entries exceeding sigma_factor × MAD-based σ.
    3. Extract into sparse correction; zero them in the dense tensor.

    Uses MAD instead of standard deviation because std is non-robust:
    a single extreme outlier inflates the channel std, hiding itself from
    detection. MAD (median of |x - median|) is resistant to contamination.
    The conversion factor 1.4826 maps MAD to the equivalent σ for normal data.

    Args:
        tensor: (b, D) — key or value block.
        sigma_factor: Outlier threshold in units of robust σ.

    Returns:
        (dense_tensor, outlier_indices, outlier_values)
        - dense_tensor: tensor with outliers zeroed out.
        - outlier_indices: (M, 2) array of (row, col) indices.
        - outlier_values: (M,) array of original outlier values.
    """
    # Per-channel robust statistics via MAD
    channel_median = np.median(tensor, axis=0)                       # (D,)
    abs_deviations = np.abs(tensor - channel_median)                 # (b, D)
    mad = np.median(abs_deviations, axis=0)                          # (D,)

    # Convert MAD to equivalent σ for normal distribution: σ ≈ 1.4826 × MAD
    robust_sigma = 1.4826 * mad
    robust_sigma = np.maximum(robust_sigma, 1e-12)                   # guard

    # Modified z-score per element
    z_scores = abs_deviations / robust_sigma                         # (b, D)
    outlier_mask = z_scores > sigma_factor                           # (b, D) bool

    # Extract
    outlier_indices = np.argwhere(outlier_mask)                       # (M, 2)
    outlier_values = tensor[outlier_mask]                             # (M,)

    # Zero out outliers in the dense copy
    dense = tensor.copy()
    dense[outlier_mask] = 0.0

    return dense, outlier_indices, outlier_values


# ── B.4 Low-Rank Residual Error Correction (GEAR) ────────────────────────────

def compute_gear_residual(
    original: np.ndarray,
    reconstructed: np.ndarray,
    rank: int = GEAR_RESIDUAL_RANK,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    GEAR (NeurIPS 2024): Compute low-rank SVD approximation of quantization error.

    E = original - reconstructed
    E ≈ U_r Σ_r V_r^T

    Transmitted at negligible cost: 2 × r × D floats vs b × D for full block.

    Returns:
        (U_r, S_r, Vt_r) — truncated SVD components.
    """
    E = original - reconstructed

    # Full SVD, then truncate to rank r
    U, S, Vt = np.linalg.svd(E, full_matrices=False)

    # Truncate
    r = min(rank, len(S))
    U_r = U[:, :r]          # (b, r)
    S_r = S[:r]             # (r,)
    Vt_r = Vt[:r, :]        # (r, D)

    return U_r, S_r, Vt_r


def reconstruct_with_gear(
    dequantized: np.ndarray,
    outlier_indices: np.ndarray,
    outlier_values: np.ndarray,
    U_r: np.ndarray,
    S_r: np.ndarray,
    Vt_r: np.ndarray,
) -> np.ndarray:
    """
    Three-layer reconstruction on the receiving node:
    B̂_corrected = Dequant(Q(B)) + S_j + U_r Σ_r V_r^T
    """
    result = dequantized.copy()

    # Add sparse outlier correction
    if len(outlier_indices) > 0:
        rows = outlier_indices[:, 0]
        cols = outlier_indices[:, 1]
        result[rows, cols] += outlier_values

    # Add low-rank residual
    residual = U_r @ np.diag(S_r) @ Vt_r
    result += residual

    return result


# ── Asymmetric Quantization Kernels ──────────────────────────────────────────

def _asymmetric_quantize_int8(
    tensor: np.ndarray,
    axis: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Asymmetric INT8 quantization along specified axis.

    Args:
        tensor: Input tensor (b, D).
        axis: 0 for per-channel (keys), 1 for per-token (values).

    Returns:
        (quantized_uint8, scales, zeros) for dequantization:
        reconstructed = (quantized - zeros) * scales
    """
    # Compute min/max along quantization axis
    t_min = tensor.min(axis=axis, keepdims=True)
    t_max = tensor.max(axis=axis, keepdims=True)

    # Scale to [0, 255]
    scale = (t_max - t_min) / 255.0
    scale = np.maximum(scale, 1e-12)

    zero_point = np.round(-t_min / scale).astype(np.uint8)
    quantized = np.clip(np.round(tensor / scale) + zero_point, 0, 255).astype(np.uint8)

    return quantized, scale.squeeze(axis=axis), zero_point.squeeze(axis=axis)


def _asymmetric_dequantize_int8(
    quantized: np.ndarray,
    scales: np.ndarray,
    zeros: np.ndarray,
    axis: int,
) -> np.ndarray:
    """Dequantize INT8 → float32."""
    scales_expanded = np.expand_dims(scales, axis=axis)
    zeros_expanded = np.expand_dims(zeros, axis=axis)
    return (quantized.astype(np.float32) - zeros_expanded) * scales_expanded


def _asymmetric_quantize_int4(
    tensor: np.ndarray,
    axis: int,
    group_size: int = INT4_GROUP_SIZE,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Asymmetric INT4 quantization with group-wise scaling.

    Packs two INT4 values per uint8 byte. Group size of 128 ensures
    local scale factors capture within-group variance.

    Returns:
        (packed_uint8, scales_per_group, zeros_per_group)
    """
    shape = tensor.shape
    quant_axis_size = shape[axis]

    # Pad to multiple of group_size
    pad_amount = (group_size - quant_axis_size % group_size) % group_size

    if pad_amount > 0:
        pad_widths = [(0, 0)] * len(shape)
        pad_widths[axis] = (0, pad_amount)
        tensor = np.pad(tensor, pad_widths, mode='constant', constant_values=0)

    new_shape = list(tensor.shape)
    n_groups = new_shape[axis] // group_size

    # Reshape to expose groups
    if axis == 0:
        grouped = tensor.reshape(n_groups, group_size, shape[1])
    else:
        grouped = tensor.reshape(shape[0], n_groups, group_size)

    # Per-group min/max
    g_min = grouped.min(axis=axis + 1, keepdims=True)
    g_max = grouped.max(axis=axis + 1, keepdims=True)
    scale = (g_max - g_min) / 15.0   # INT4 range: [0, 15]
    scale = np.maximum(scale, 1e-12)

    zero_point = np.round(-g_min / scale).astype(np.uint8)
    quantized = np.clip(np.round(grouped / scale) + zero_point, 0, 15).astype(np.uint8)

    # Pack pairs of INT4 into uint8: high nibble + low nibble
    if axis == 0:
        flat = quantized.reshape(-1, shape[1])
    else:
        flat = quantized.reshape(shape[0], -1)

    quant_dim = flat.shape[axis]
    if quant_dim % 2 != 0:
        pad_w = [(0, 0)] * len(flat.shape)
        pad_w[axis] = (0, 1)
        flat = np.pad(flat, pad_w, mode='constant', constant_values=0)

    if axis == 0:
        even = flat[0::2, :]
        odd = flat[1::2, :]
    else:
        even = flat[:, 0::2]
        odd = flat[:, 1::2]

    packed = (even << 4) | (odd & 0x0F)

    return packed.astype(np.uint8), scale.squeeze(axis=axis + 1), zero_point.squeeze(axis=axis + 1)


def _asymmetric_dequantize_int4(
    packed: np.ndarray,
    scales: np.ndarray,
    zeros: np.ndarray,
    axis: int,
    original_axis_size: int,
    group_size: int = INT4_GROUP_SIZE,
) -> np.ndarray:
    """Dequantize packed INT4 → float32."""
    # Unpack nibbles
    if axis == 0:
        high = (packed >> 4) & 0x0F
        low = packed & 0x0F
        unpacked = np.empty((packed.shape[0] * 2, packed.shape[1]), dtype=np.uint8)
        unpacked[0::2, :] = high
        unpacked[1::2, :] = low
    else:
        high = (packed >> 4) & 0x0F
        low = packed & 0x0F
        unpacked = np.empty((packed.shape[0], packed.shape[1] * 2), dtype=np.uint8)
        unpacked[:, 0::2] = high
        unpacked[:, 1::2] = low

    # Trim to padded group size
    n_groups = int(np.ceil(original_axis_size / group_size))
    padded_size = n_groups * group_size

    if axis == 0:
        unpacked = unpacked[:padded_size, :]
        grouped = unpacked.reshape(n_groups, group_size, unpacked.shape[1])
    else:
        unpacked = unpacked[:, :padded_size]
        grouped = unpacked.reshape(unpacked.shape[0], n_groups, group_size)

    # Expand scales/zeros to match grouped shape
    scales_exp = np.expand_dims(scales, axis=axis + 1)
    zeros_exp = np.expand_dims(zeros, axis=axis + 1)

    dequantized = (grouped.astype(np.float32) - zeros_exp) * scales_exp

    # Flatten back and trim
    if axis == 0:
        flat = dequantized.reshape(-1, dequantized.shape[2])
        return flat[:original_axis_size, :]
    else:
        flat = dequantized.reshape(dequantized.shape[0], -1)
        return flat[:, :original_axis_size]


# ═══════════════════════════════════════════════════════════════════════════════
# Full Quantization Pipeline
# ═══════════════════════════════════════════════════════════════════════════════

def _quantize_tensor(
    tensor: np.ndarray,
    tier: QuantTier,
    axis: int,
) -> Tuple[np.ndarray, str, Optional[np.ndarray], Optional[np.ndarray]]:
    """Quantize a single tensor according to the tier."""
    if tier == QuantTier.HIGH:
        q, s, z = _asymmetric_quantize_int4(tensor, axis=axis)
        return q, "int4", s, z
    elif tier == QuantTier.MEDIUM:
        q, s, z = _asymmetric_quantize_int8(tensor, axis=axis)
        return q, "int8", s, z
    else:
        return tensor.astype(np.float16), "float16", None, None


def _dequantize_tensor(
    quantized: np.ndarray,
    dtype_tag: str,
    scales: Optional[np.ndarray],
    zeros: Optional[np.ndarray],
    axis: int,
    original_axis_size: int,
) -> np.ndarray:
    """Dequantize a single tensor."""
    if dtype_tag == "int4":
        return _asymmetric_dequantize_int4(quantized, scales, zeros, axis, original_axis_size)
    elif dtype_tag == "int8":
        return _asymmetric_dequantize_int8(quantized, scales, zeros, axis)
    else:
        return quantized.astype(np.float32)


def quantize_block(block: KVBlock) -> QuantizedBlock:
    """
    Full Stage B pipeline for a single KV block:
    1. Compute angular coherence → classify tier.
    2. Isolate outliers (dense-and-sparse decomposition).
    3. Quantize dense portion at classified precision.
    4. Compute GEAR low-rank residual correction.
    """
    coherence = compute_angular_coherence(block)
    tier = classify_quant_tier(coherence)

    if tier == QuantTier.LOW:
        # FP16 passthrough — no quantization, no outlier isolation needed
        return QuantizedBlock(
            block_idx=block.block_idx,
            tier=tier,
            coherence=coherence,
            keys_quantized=block.keys.astype(np.float16),
            values_quantized=block.values.astype(np.float16),
            keys_dtype_tag="float16",
            values_dtype_tag="float16",
        )

    # B.3 — Outlier Isolation
    keys_dense, k_out_idx, k_out_val = isolate_outliers(block.keys)
    vals_dense, v_out_idx, v_out_val = isolate_outliers(block.values)

    # B.1 — Asymmetric quantization: Keys per-channel (axis=0), Values per-token (axis=1)
    k_q, k_dtag, k_s, k_z = _quantize_tensor(keys_dense, tier, axis=0)
    v_q, v_dtag, v_s, v_z = _quantize_tensor(vals_dense, tier, axis=1)

    # Dequantize for GEAR residual computation
    k_deq = _dequantize_tensor(k_q, k_dtag, k_s, k_z, axis=0, original_axis_size=block.block_size)
    v_deq = _dequantize_tensor(v_q, v_dtag, v_s, v_z, axis=1, original_axis_size=block.embed_dim)

    # B.4 — GEAR low-rank residual
    # Residual is computed against the dense (outlier-removed) version
    k_U, k_S, k_Vt = compute_gear_residual(keys_dense, k_deq)
    v_U, v_S, v_Vt = compute_gear_residual(vals_dense, v_deq)

    return QuantizedBlock(
        block_idx=block.block_idx,
        tier=tier,
        coherence=coherence,
        keys_quantized=k_q,
        values_quantized=v_q,
        keys_dtype_tag=k_dtag,
        values_dtype_tag=v_dtag,
        keys_scales=k_s,
        keys_zeros=k_z,
        values_scales=v_s,
        values_zeros=v_z,
        keys_outlier_indices=k_out_idx,
        keys_outlier_values=k_out_val,
        values_outlier_indices=v_out_idx,
        values_outlier_values=v_out_val,
        keys_residual_U=k_U,
        keys_residual_S=k_S,
        keys_residual_Vt=k_Vt,
        values_residual_U=v_U,
        values_residual_S=v_S,
        values_residual_Vt=v_Vt,
    )


def dequantize_block(qblock: QuantizedBlock, original_block_size: int, embed_dim: int) -> KVBlock:
    """
    Full reconstruction on the receiving node:
    B̂_corrected = Dequant(Q(B)) + S_j + U_r Σ_r V_r^T
    """
    if qblock.tier == QuantTier.LOW:
        return KVBlock(
            block_idx=qblock.block_idx,
            keys=qblock.keys_quantized.astype(np.float32),
            values=qblock.values_quantized.astype(np.float32),
        )

    # Dequantize base
    k_deq = _dequantize_tensor(
        qblock.keys_quantized, qblock.keys_dtype_tag,
        qblock.keys_scales, qblock.keys_zeros,
        axis=0, original_axis_size=original_block_size,
    )
    v_deq = _dequantize_tensor(
        qblock.values_quantized, qblock.values_dtype_tag,
        qblock.values_scales, qblock.values_zeros,
        axis=1, original_axis_size=embed_dim,
    )

    # Three-layer reconstruction
    keys_reconstructed = reconstruct_with_gear(
        k_deq,
        qblock.keys_outlier_indices, qblock.keys_outlier_values,
        qblock.keys_residual_U, qblock.keys_residual_S, qblock.keys_residual_Vt,
    )
    values_reconstructed = reconstruct_with_gear(
        v_deq,
        qblock.values_outlier_indices, qblock.values_outlier_values,
        qblock.values_residual_U, qblock.values_residual_S, qblock.values_residual_Vt,
    )

    return KVBlock(
        block_idx=qblock.block_idx,
        keys=keys_reconstructed,
        values=values_reconstructed,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Top-Level Compression API
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class CompressionResult:
    """Result of the full AETHER-Swarm compression pipeline."""
    active_blocks: List[QuantizedBlock]
    pruned_indices: List[int]
    total_blocks: int
    original_tokens: int
    embed_dim: int
    block_size: int

    @property
    def surviving_ratio(self) -> float:
        return len(self.active_blocks) / max(self.total_blocks, 1)

    @property
    def tier_distribution(self) -> dict:
        dist = {t.name: 0 for t in QuantTier}
        for b in self.active_blocks:
            dist[b.tier.name] += 1
        return dist


def compress_kv_cache(
    keys: np.ndarray,
    values: np.ndarray,
    query_centroid: np.ndarray,
    block_size: int = DEFAULT_BLOCK_SIZE,
    theta: float = DEFAULT_PRUNING_THETA,
) -> CompressionResult:
    """
    Full AETHER-Swarm compression pipeline:
    1. Partition KV-cache into blocks.
    2. Stage A: Geometric pruning (Cauchy-Schwarz bound).
    3. Stage B: 3-tier asymmetric quantization with outlier isolation + GEAR residual.

    Args:
        keys:   (N, D) full key cache.
        values: (N, D) full value cache.
        query_centroid: (D,) centroid of current query manifold.
        block_size: Tokens per block.
        theta: Pruning relevance threshold.

    Returns:
        CompressionResult with quantized active blocks and metadata.
    """
    N, D = keys.shape

    # Partition
    blocks = partition_kv_cache(keys, values, block_size)

    # Stage A — Geometric Prune
    surviving, pruned = geometric_prune(blocks, query_centroid, theta)

    # Stage B — Quantize surviving blocks
    quantized_blocks = [quantize_block(b) for b in surviving]

    return CompressionResult(
        active_blocks=quantized_blocks,
        pruned_indices=pruned,
        total_blocks=len(blocks),
        original_tokens=N,
        embed_dim=D,
        block_size=block_size,
    )


def decompress_kv_cache(
    result: CompressionResult,
) -> Tuple[List[KVBlock], List[int]]:
    """
    Decompress on the receiving node. Returns reconstructed blocks
    and the list of pruned block indices (which the receiver must handle).
    """
    reconstructed = []
    for qb in result.active_blocks:
        b_size = result.block_size
        # Last block may be smaller
        if qb.keys_dtype_tag == "float16":
            b_size = qb.keys_quantized.shape[0]

        reconstructed.append(dequantize_block(qb, b_size, result.embed_dim))

    return reconstructed, result.pruned_indices
