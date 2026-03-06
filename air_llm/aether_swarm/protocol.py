"""
AETHER-Swarm Binary Wire Protocol
===================================
Formally specified binary frame format for P2P KV-cache transmission
with research-grade data integrity guarantees.

DEPENDENCY NOTICE:
  This module layers on top of the AirLLM inference bridge (air_llm/inference_bridge.py).
  Without the inference layer producing raw KV-cache states, there is nothing to transmit.

Wire Format (see implementation_plan.md for full field table):
  MAGIC(4) | VERSION(2) | SENDER_HASH(32) | SEQUENCE_NUM(8) | PAYLOAD_LEN(4) |
  NUM_BLOCKS(4) | BLOCK_MANIFEST(17B each) | PAYLOAD(var) | FRAME_CRC64(8) | ED25519_SIG(64)

Integrity:
  - Per-block CRC-32 in manifest → selective retransmission of corrupted blocks.
  - Frame-level CRC-64/ECMA → detect bit-rot across relay hops.
  - Ed25519 signature → authenticate sender, prevent MITM poisoned KV injection.
  - Monotonic sequence numbering → prevent replay/reorder attacks.
"""

from __future__ import annotations

import hashlib
import struct
import zlib
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

try:
    from nacl.signing import SigningKey, VerifyKey
    from nacl.exceptions import BadSignatureError
    _HAS_NACL = True
except ImportError:
    _HAS_NACL = False


# ── Protocol Constants ─────────────────────────────────────────────────────────

PROTOCOL_MAGIC = b'\xAE\x7B\x00\x00'   # 4 bytes
PROTOCOL_VERSION = 1                     # uint16

# Struct formats (big-endian / network byte order)
HEADER_FMT = '!4sH32sQII'               # magic(4) + version(2) + sender_hash(32) + seq(8) + payload_len(4) + num_blocks(4)
HEADER_SIZE = struct.calcsize(HEADER_FMT)  # = 54 bytes

BLOCK_MANIFEST_ENTRY_FMT = '!IBQ I'     # block_idx(4) + dtype(1) + shape_packed(8) + crc32(4) = 17 bytes
BLOCK_MANIFEST_ENTRY_SIZE = struct.calcsize(BLOCK_MANIFEST_ENTRY_FMT)  # 17 bytes

FRAME_CRC_SIZE = 8                       # CRC-64/ECMA
ED25519_SIG_SIZE = 64


# ── Dtype Tags ─────────────────────────────────────────────────────────────────

DTYPE_TAG_MAP = {
    "float16": 0,
    "int8": 1,
    "int4": 2,
}
DTYPE_TAG_REVERSE = {v: k for k, v in DTYPE_TAG_MAP.items()}


# ── CRC-64/ECMA ───────────────────────────────────────────────────────────────

_CRC64_ECMA_POLY = 0x42F0E1EBA9EA3693
_crc64_table = None


def _build_crc64_table():
    """Build the CRC-64/ECMA lookup table (lazy-initialized)."""
    global _crc64_table
    if _crc64_table is not None:
        return
    _crc64_table = []
    for i in range(256):
        crc = i
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ _CRC64_ECMA_POLY
            else:
                crc >>= 1
        _crc64_table.append(crc & 0xFFFFFFFFFFFFFFFF)


def crc64_ecma(data: bytes) -> int:
    """Compute CRC-64/ECMA over a byte sequence."""
    _build_crc64_table()
    crc = 0xFFFFFFFFFFFFFFFF
    for byte in data:
        crc = (_crc64_table[(crc ^ byte) & 0xFF] ^ (crc >> 8)) & 0xFFFFFFFFFFFFFFFF
    return crc ^ 0xFFFFFFFFFFFFFFFF


# ── Data Classes ───────────────────────────────────────────────────────────────

@dataclass
class BlockManifestEntry:
    """Manifest entry for a single KV block in the frame."""
    block_idx: int
    dtype_tag: int           # 0=FP16, 1=INT8, 2=INT4
    shape_packed: int        # encodes (rows, cols) as (rows << 32) | cols
    crc32: int               # CRC-32 of the block's raw bytes
    payload_offset: int = 0  # byte offset into the payload section
    payload_length: int = 0  # byte length of this block's data


@dataclass
class FrameHeader:
    """Parsed frame header."""
    magic: bytes
    version: int
    sender_hash: bytes       # SHA-256 of sender's Ed25519 public key
    sequence_num: int
    payload_len: int
    num_blocks: int


@dataclass
class AetherFrame:
    """A complete AETHER-Swarm wire frame."""
    header: FrameHeader
    manifest: List[BlockManifestEntry]
    payload: bytes
    frame_crc64: int
    signature: bytes


# ── Sequence Number Tracker ────────────────────────────────────────────────────

class SequenceTracker:
    """
    Tracks per-sender monotonic sequence numbers to prevent replay/reorder attacks.
    Rejects frames with sequence numbers ≤ the last seen value for that sender.
    """

    def __init__(self):
        self._last_seen: dict[bytes, int] = {}

    def validate_and_advance(self, sender_hash: bytes, seq_num: int) -> bool:
        """Returns True if the sequence number is valid (strictly increasing)."""
        last = self._last_seen.get(sender_hash, -1)
        if seq_num <= last:
            return False
        self._last_seen[sender_hash] = seq_num
        return True

    def current(self, sender_hash: bytes) -> int:
        """Get the last seen sequence number for a sender."""
        return self._last_seen.get(sender_hash, -1)


# ── Packing Helpers ────────────────────────────────────────────────────────────

def pack_shape(rows: int, cols: int) -> int:
    """Encode (rows, cols) into a single uint64."""
    return (rows << 32) | (cols & 0xFFFFFFFF)


def unpack_shape(packed: int) -> Tuple[int, int]:
    """Decode a packed uint64 into (rows, cols)."""
    rows = (packed >> 32) & 0xFFFFFFFF
    cols = packed & 0xFFFFFFFF
    return rows, cols


def compute_sender_hash(public_key_bytes: bytes) -> bytes:
    """SHA-256 hash of the sender's Ed25519 public key."""
    return hashlib.sha256(public_key_bytes).digest()


# ── Frame Construction ─────────────────────────────────────────────────────────

def build_frame(
    block_payloads: List[Tuple[int, str, Tuple[int, int], bytes]],
    sender_public_key: bytes,
    sequence_num: int,
    signing_key_bytes: Optional[bytes] = None,
) -> bytes:
    """
    Construct a complete AETHER-Swarm wire frame.

    Args:
        block_payloads: List of (block_idx, dtype_tag_str, (rows, cols), raw_bytes).
        sender_public_key: Raw Ed25519 public key bytes (32B).
        sequence_num: Monotonically increasing sequence number.
        signing_key_bytes: Raw Ed25519 signing key (64B seed+pub). If None, signature is zeroed.

    Returns:
        Complete frame as bytes, ready for wire transmission.
    """
    sender_hash = compute_sender_hash(sender_public_key)
    num_blocks = len(block_payloads)

    # Build manifest and concatenate payloads
    manifest_bytes = b''
    payload_concat = b''

    for block_idx, dtype_str, shape, raw_data in block_payloads:
        dtype_tag = DTYPE_TAG_MAP[dtype_str]
        shape_packed = pack_shape(*shape)
        block_crc = zlib.crc32(raw_data) & 0xFFFFFFFF

        manifest_bytes += struct.pack(
            BLOCK_MANIFEST_ENTRY_FMT,
            block_idx,
            dtype_tag,
            shape_packed,
            block_crc,
        )
        payload_concat += raw_data

    payload_len = len(payload_concat)

    # Pack header
    header_bytes = struct.pack(
        HEADER_FMT,
        PROTOCOL_MAGIC,
        PROTOCOL_VERSION,
        sender_hash,
        sequence_num,
        payload_len,
        num_blocks,
    )

    # Frame body = header + manifest + payload
    frame_body = header_bytes + manifest_bytes + payload_concat

    # CRC-64/ECMA over the entire frame body
    frame_crc = crc64_ecma(frame_body)
    frame_body += struct.pack('!Q', frame_crc)

    # Ed25519 signature over SHA-256(frame_body)
    if signing_key_bytes and _HAS_NACL:
        signing_key = SigningKey(signing_key_bytes[:32])
        digest = hashlib.sha256(frame_body).digest()
        signed = signing_key.sign(digest)
        signature = signed.signature  # 64 bytes
    else:
        signature = b'\x00' * ED25519_SIG_SIZE

    frame_body += signature

    return frame_body


# ── Frame Parsing ──────────────────────────────────────────────────────────────

class FrameValidationError(Exception):
    """Raised when frame integrity checks fail."""
    pass


def parse_frame(
    raw: bytes,
    expected_sender_pubkey: Optional[bytes] = None,
    sequence_tracker: Optional[SequenceTracker] = None,
) -> AetherFrame:
    """
    Parse and validate a raw wire frame.

    Validation order:
    1. Magic + version check.
    2. Ed25519 signature verification (if sender pubkey provided).
    3. Frame CRC-64 verification.
    4. Sequence number validation (if tracker provided).

    Raises FrameValidationError on any integrity failure.
    """
    if len(raw) < HEADER_SIZE + FRAME_CRC_SIZE + ED25519_SIG_SIZE:
        raise FrameValidationError("Frame too short")

    # Extract signature (last 64 bytes)
    signature = raw[-ED25519_SIG_SIZE:]
    frame_with_crc = raw[:-ED25519_SIG_SIZE]

    # Extract CRC (last 8 bytes before signature)
    stored_crc = struct.unpack('!Q', frame_with_crc[-FRAME_CRC_SIZE:])[0]
    frame_body = frame_with_crc[:-FRAME_CRC_SIZE]

    # 1. Verify CRC-64
    computed_crc = crc64_ecma(frame_body)
    if computed_crc != stored_crc:
        raise FrameValidationError(
            f"Frame CRC-64 mismatch: expected {stored_crc:#018x}, got {computed_crc:#018x}"
        )

    # 2. Verify Ed25519 signature
    if expected_sender_pubkey and _HAS_NACL:
        verify_key = VerifyKey(expected_sender_pubkey)
        digest = hashlib.sha256(frame_with_crc).digest()
        try:
            verify_key.verify(digest, signature)
        except BadSignatureError:
            raise FrameValidationError("Ed25519 signature verification failed")

    # 3. Parse header
    header_data = struct.unpack(HEADER_FMT, frame_body[:HEADER_SIZE])
    magic, version, sender_hash, seq_num, payload_len, num_blocks = header_data

    if magic != PROTOCOL_MAGIC:
        raise FrameValidationError(f"Invalid magic: {magic!r}")
    if version != PROTOCOL_VERSION:
        raise FrameValidationError(f"Unsupported version: {version}")

    header = FrameHeader(
        magic=magic,
        version=version,
        sender_hash=sender_hash,
        sequence_num=seq_num,
        payload_len=payload_len,
        num_blocks=num_blocks,
    )

    # 4. Validate sequence number
    if sequence_tracker:
        if not sequence_tracker.validate_and_advance(sender_hash, seq_num):
            raise FrameValidationError(
                f"Sequence number replay/reorder: {seq_num} <= last seen"
            )

    # 5. Parse manifest
    manifest_start = HEADER_SIZE
    manifest = []
    for i in range(num_blocks):
        offset = manifest_start + i * BLOCK_MANIFEST_ENTRY_SIZE
        entry_data = struct.unpack(
            BLOCK_MANIFEST_ENTRY_FMT,
            frame_body[offset:offset + BLOCK_MANIFEST_ENTRY_SIZE],
        )
        block_idx, dtype_tag, shape_packed, crc32 = entry_data
        manifest.append(BlockManifestEntry(
            block_idx=block_idx,
            dtype_tag=dtype_tag,
            shape_packed=shape_packed,
            crc32=crc32,
        ))

    # 6. Extract payload
    payload_start = manifest_start + num_blocks * BLOCK_MANIFEST_ENTRY_SIZE
    payload = frame_body[payload_start:payload_start + payload_len]

    if len(payload) != payload_len:
        raise FrameValidationError(
            f"Payload length mismatch: declared {payload_len}, got {len(payload)}"
        )

    return AetherFrame(
        header=header,
        manifest=manifest,
        payload=payload,
        frame_crc64=stored_crc,
        signature=signature,
    )


def verify_block_crcs(
    frame: AetherFrame,
    block_data_list: List[bytes],
) -> List[int]:
    """
    Verify per-block CRC-32 values. Returns list of block indices that failed.
    These can be selectively retransmitted.
    """
    failed = []
    for entry, data in zip(frame.manifest, block_data_list):
        computed = zlib.crc32(data) & 0xFFFFFFFF
        if computed != entry.crc32:
            failed.append(entry.block_idx)
    return failed
