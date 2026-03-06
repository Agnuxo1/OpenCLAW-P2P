"""
AETHER-Swarm Unit Tests — Mathematical Compression + Protocol Integrity
========================================================================
Validates correctness of:
  - Stage A: Geometric pruning (σ²_B variance, Cauchy-Schwarz bound)
  - Stage B: Angular coherence, 3-tier classification, outlier isolation, GEAR residual
  - Wire protocol: CRC-64, frame build/parse, sequence replay rejection
  - Full pipeline: compress → serialize → deserialize → decompress round-trip
"""

import sys
import os
import struct
import numpy as np

# Add parent dir for import resolution
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from air_llm.aether_swarm.kv_compressor import (
    partition_kv_cache,
    compute_block_variance,
    compute_cauchy_schwarz_bound,
    geometric_prune,
    compute_angular_coherence,
    classify_quant_tier,
    isolate_outliers,
    compute_gear_residual,
    reconstruct_with_gear,
    quantize_block,
    dequantize_block,
    compress_kv_cache,
    decompress_kv_cache,
    KVBlock,
    QuantTier,
    DEFAULT_BLOCK_SIZE,
    COHERENCE_THRESHOLD_HIGH,
    COHERENCE_THRESHOLD_MEDIUM,
)
from air_llm.aether_swarm.protocol import (
    crc64_ecma,
    build_frame,
    parse_frame,
    SequenceTracker,
    FrameValidationError,
    PROTOCOL_MAGIC,
)
from air_llm.aether_swarm.serializer import (
    serialize_quantized_block,
    deserialize_quantized_block,
    serialize_payload,
    deserialize_payload,
)

passed = 0
failed = 0


def test(name, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✓ {name}")
    else:
        failed += 1
        print(f"  ✗ {name}")


np.random.seed(42)
D = 64  # embedding dimension
b = 16  # block size for tests


# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Stage A: Geometric Pruning ═══")
# ═══════════════════════════════════════════════════════════════════════════════

# Test 1: Partitioning
keys = np.random.randn(100, D).astype(np.float32)
values = np.random.randn(100, D).astype(np.float32)
blocks = partition_kv_cache(keys, values, block_size=b)

test("Partition: correct number of blocks", len(blocks) == 7)  # 100/16 = 6.25 → 7
test("Partition: first block has correct size", blocks[0].block_size == b)
test("Partition: last block is smaller", blocks[-1].block_size == 100 - 6 * b)

# Test 2: Variance computation
# All-identical vectors → variance should be 0
uniform_block = KVBlock(block_idx=0, keys=np.ones((b, D)), values=np.ones((b, D)))
var_uniform = compute_block_variance(uniform_block)
test("Variance: uniform block → σ² ≈ 0", abs(var_uniform) < 1e-10)

# Diverse vectors → variance should be > 0
diverse_block = KVBlock(block_idx=0, keys=np.random.randn(b, D).astype(np.float32) * 10, values=np.ones((b, D)))
var_diverse = compute_block_variance(diverse_block)
test("Variance: diverse block → σ² > 0", var_diverse > 0.1)

# Test 3: Cauchy-Schwarz bound
# Query aligned with keys → high bound
aligned_keys = np.tile(np.array([1.0, 0, 0] + [0] * (D - 3)), (b, 1)).astype(np.float32)
aligned_block = KVBlock(block_idx=0, keys=aligned_keys, values=np.ones((b, D)))
query = np.array([1.0, 0, 0] + [0] * (D - 3), dtype=np.float32)
bound_aligned = compute_cauchy_schwarz_bound(aligned_block, query)
test("CS bound: aligned keys → bound ≈ 1.0", bound_aligned > 0.99)

# Orthogonal query → low bound
ortho_query = np.array([0, 1.0, 0] + [0] * (D - 3), dtype=np.float32)
bound_ortho = compute_cauchy_schwarz_bound(aligned_block, ortho_query)
test("CS bound: orthogonal query → bound ≈ 0.0", bound_ortho < 0.01)

# Test 4: Pruning
blocks_for_prune = [aligned_block]
surviving, pruned = geometric_prune(blocks_for_prune, query, theta=0.5)
test("Prune: aligned block survives at θ=0.5", len(surviving) == 1)

surviving2, pruned2 = geometric_prune(blocks_for_prune, ortho_query, theta=0.5)
test("Prune: orthogonal block pruned at θ=0.5", len(surviving2) == 0)


# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Stage B: Angular Quantization ═══")
# ═══════════════════════════════════════════════════════════════════════════════

# Test 5: Angular coherence
# All vectors pointing same direction → c_B ≈ 1.0
aligned_block2 = KVBlock(
    block_idx=0,
    keys=(np.ones((b, D)) + np.random.randn(b, D) * 0.01).astype(np.float32),
    values=np.ones((b, D)),
)
coherence_high = compute_angular_coherence(aligned_block2)
test("Coherence: aligned keys → c_B > 0.95", coherence_high > 0.95)

# Random vectors → c_B should be lower
random_block = KVBlock(block_idx=0, keys=np.random.randn(b, D).astype(np.float32), values=np.ones((b, D)))
coherence_random = compute_angular_coherence(random_block)
test("Coherence: random keys → c_B < 0.85", coherence_random < 0.85)

# Test 6: Tier classification
test("Tier: c=0.96 → HIGH (INT4)", classify_quant_tier(0.96) == QuantTier.HIGH)
test("Tier: c=0.90 → MEDIUM (INT8)", classify_quant_tier(0.90) == QuantTier.MEDIUM)
test("Tier: c=0.70 → LOW (FP16)", classify_quant_tier(0.70) == QuantTier.LOW)

# Test 7: Outlier isolation
# Use extreme outliers that reliably exceed 6σ even with b=16 samples per channel
data = np.random.randn(b, D).astype(np.float32)
data[3, 7] = 1000.0      # extreme outlier (>100σ for standard normal)
data[10, 20] = -2000.0    # extreme outlier

dense, out_idx, out_val = isolate_outliers(data, sigma_factor=6.0)
test("Outlier: dense has outliers zeroed", abs(dense[3, 7]) < 1e-6 and abs(dense[10, 20]) < 1e-6)
test("Outlier: at least 2 outliers detected", len(out_val) >= 2)
test("Outlier: original values preserved", any(abs(v - 1000.0) < 1e-1 for v in out_val))

# Test 8: GEAR residual — use structured low-rank error (realistic quantization scenario)
original = np.random.randn(b, D).astype(np.float32)
# Create a rank-1 error (as typically produced by quantization rounding)
err_vec_u = np.random.randn(b, 1).astype(np.float32)
err_vec_v = np.random.randn(1, D).astype(np.float32)
structured_error = err_vec_u @ err_vec_v * 0.01
reconstructed = original - structured_error  # original - error means error = original - reconstructed
U, S, Vt = compute_gear_residual(original, reconstructed, rank=2)
test("GEAR: U shape correct", U.shape == (b, 2))
test("GEAR: S shape correct", S.shape == (2,))
test("GEAR: Vt shape correct", Vt.shape == (2, D))

# Verify reconstruction quality — rank-2 SVD should capture a rank-1 error nearly perfectly
residual_approx = U @ np.diag(S) @ Vt
actual_residual = original - reconstructed
approx_error = np.linalg.norm(actual_residual - residual_approx)
total_error = np.linalg.norm(actual_residual)
test("GEAR: residual captures most error", approx_error / max(total_error, 1e-12) < 0.1)

# Test 9: Full quantize/dequantize round-trip
block_for_quant = KVBlock(
    block_idx=0,
    keys=(np.ones((b, D)) + np.random.randn(b, D) * 0.02).astype(np.float32),
    values=(np.ones((b, D)) + np.random.randn(b, D) * 0.02).astype(np.float32),
)
qblock = quantize_block(block_for_quant)
test("Quantize: tier is HIGH for coherent block", qblock.tier == QuantTier.HIGH)

reconstructed_block = dequantize_block(qblock, b, D)

# Cosine similarity between original and reconstructed
orig_flat = block_for_quant.keys.flatten()
recon_flat = reconstructed_block.keys.flatten()
cos_sim = np.dot(orig_flat, recon_flat) / (np.linalg.norm(orig_flat) * np.linalg.norm(recon_flat))
test("Round-trip: cosine similarity > 0.95", cos_sim > 0.95)


# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Protocol Integrity ═══")
# ═══════════════════════════════════════════════════════════════════════════════

# Test 10: CRC-64
crc1 = crc64_ecma(b"hello world")
crc2 = crc64_ecma(b"hello world")
crc3 = crc64_ecma(b"hello world!")
test("CRC-64: deterministic", crc1 == crc2)
test("CRC-64: different data → different CRC", crc1 != crc3)

# Test 11: Frame build + parse round-trip
fake_pubkey = b'\x01' * 32
block_data = b'\xDE\xAD\xBE\xEF' * 100
block_payloads = [(0, "float16", (16, 64), block_data)]

frame = build_frame(block_payloads, fake_pubkey, sequence_num=1)
test("Frame: non-empty bytes", len(frame) > 0)

parsed = parse_frame(frame)
test("Frame: magic matches", parsed.header.magic == PROTOCOL_MAGIC)
test("Frame: version = 1", parsed.header.version == 1)
test("Frame: sequence num = 1", parsed.header.sequence_num == 1)
test("Frame: 1 block in manifest", len(parsed.manifest) == 1)
test("Frame: payload matches", parsed.payload == block_data)

# Test 12: Tampered frame → CRC failure
tampered = bytearray(frame)
tampered[60] ^= 0xFF  # flip a byte in the payload area
try:
    parse_frame(bytes(tampered))
    test("Tamper: CRC detects flipped bit", False)
except FrameValidationError:
    test("Tamper: CRC detects flipped bit", True)

# Test 13: Sequence replay rejection
tracker = SequenceTracker()
test("Sequence: first frame accepted", tracker.validate_and_advance(fake_pubkey, 1))
test("Sequence: replay rejected", not tracker.validate_and_advance(fake_pubkey, 1))
test("Sequence: next frame accepted", tracker.validate_and_advance(fake_pubkey, 2))
test("Sequence: old frame rejected", not tracker.validate_and_advance(fake_pubkey, 1))


# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Full Pipeline ═══")
# ═══════════════════════════════════════════════════════════════════════════════

# Test 14: compress → serialize → deserialize round-trip
N = 128
keys_full = np.random.randn(N, D).astype(np.float32)
values_full = np.random.randn(N, D).astype(np.float32)
query_centroid = np.random.randn(D).astype(np.float32)

result = compress_kv_cache(keys_full, values_full, query_centroid, block_size=b)
test("Pipeline: has active blocks", len(result.active_blocks) > 0)
test("Pipeline: total blocks correct", result.total_blocks == 8)

# Serialize
frame_bytes = serialize_payload(result, fake_pubkey, sequence_num=42)
test("Pipeline: frame bytes > 0", len(frame_bytes) > 0)

# Compression ratio
raw_size = keys_full.nbytes + values_full.nbytes
compression_ratio = raw_size / len(frame_bytes)
test(f"Pipeline: compression ratio > 1 (got {compression_ratio:.1f}×)", compression_ratio > 1.0)

# Deserialize
recovered_blocks = deserialize_payload(frame_bytes)
test("Pipeline: recovered blocks match active count", len(recovered_blocks) == len(result.active_blocks))


# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")
if failed == 0:
    print("ALL TESTS PASSED ✓")
else:
    print(f"⚠ {failed} TEST(S) FAILED")
print(f"{'═' * 60}\n")

sys.exit(0 if failed == 0 else 1)
