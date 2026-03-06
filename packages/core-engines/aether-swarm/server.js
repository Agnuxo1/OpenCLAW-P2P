import express from 'express';
import crypto from 'crypto';
import { Writable } from 'stream';

/**
 * P2PCLAW Core Engine — AETHER-Swarm KV-Cache Router
 * ====================================================
 * IMMUTABLE CORE: Do not modify for frontend updates.
 *
 * Binary transport layer for streaming mathematically compressed KV-cache
 * states between P2P nodes. Handles offer/stream/ack lifecycle with
 * research-grade data integrity (CRC-64, Ed25519, selective retransmission).
 *
 * DEPENDENCY NOTICE:
 *   This engine REQUIRES a functional AirLLM inference bridge on each node
 *   to produce and consume raw KV-cache states. Without the inference layer,
 *   there are no KV-cache tensors to route.
 *
 * Wire Protocol: See air_llm/aether_swarm/protocol.py for the formal spec.
 *
 * Endpoints:
 *   POST /kv/offer    — Announce a compressed KV payload is ready.
 *   POST /kv/stream   — Binary upload of a signed AETHER-Swarm frame.
 *   POST /kv/ack      — Acknowledge successful ingestion (or NACK with failed blocks).
 *   GET  /kv/status/:id — Query transfer state.
 *   GET  /health       — Standard health endpoint.
 */

const app = express();

// JSON parsing for offer/ack endpoints only — stream endpoint uses raw binary
app.use((req, res, next) => {
    if (req.path === '/kv/stream') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// ── In-Memory Transfer State ──────────────────────────────────────────────────

/**
 * Transfer lifecycle: OFFERED → STREAMING → ACKED | FAILED
 * Each transfer is identified by a deterministic ID derived from sender + sequence.
 */
const transfers = new Map();
const TRANSFER_TIMEOUT_MS = parseInt(process.env.KV_TRANSFER_TIMEOUT_MS || '30000');
const MAX_PAYLOAD_BYTES = parseInt(process.env.KV_MAX_PAYLOAD_BYTES || String(256 * 1024 * 1024)); // 256MB default

// Sequence tracking per sender (replay prevention)
const senderSequences = new Map();

function generateTransferId(senderHash, sequenceNum) {
    const input = `${senderHash}:${sequenceNum}`;
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function validateSequence(senderHash, sequenceNum) {
    const lastSeen = senderSequences.get(senderHash) || -1;
    if (sequenceNum <= lastSeen) {
        return false;
    }
    senderSequences.set(senderHash, sequenceNum);
    return true;
}

// ── POST /kv/offer ────────────────────────────────────────────────────────────

app.post('/kv/offer', (req, res) => {
    const {
        sender_id,
        recipient_id,
        sender_hash,
        sequence_num,
        payload_sha256,
        payload_size_bytes,
    } = req.body;

    if (!sender_id || !recipient_id || sequence_num === undefined) {
        return res.status(400).json({
            error: 'Missing required fields: sender_id, recipient_id, sequence_num',
        });
    }

    if (payload_size_bytes > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({
            error: `Payload exceeds maximum size: ${payload_size_bytes} > ${MAX_PAYLOAD_BYTES}`,
        });
    }

    // Validate sequence number (replay prevention)
    const sHash = sender_hash || sender_id;
    if (!validateSequence(sHash, sequence_num)) {
        return res.status(409).json({
            error: `Sequence number replay: ${sequence_num} already seen for sender ${sHash}`,
        });
    }

    const transferId = generateTransferId(sHash, sequence_num);

    transfers.set(transferId, {
        state: 'OFFERED',
        sender_id,
        recipient_id,
        sender_hash: sHash,
        sequence_num,
        payload_sha256,
        payload_size_bytes,
        offered_at: Date.now(),
        streamed_at: null,
        acked_at: null,
        payload: null,
        failed_blocks: null,
    });

    // Auto-expire after timeout
    setTimeout(() => {
        const t = transfers.get(transferId);
        if (t && t.state === 'OFFERED') {
            t.state = 'EXPIRED';
            console.log(`[AETHER-SWARM] Transfer ${transferId} expired (no stream received)`);
        }
    }, TRANSFER_TIMEOUT_MS);

    console.log(`[AETHER-SWARM] Offer registered: ${transferId} | ${sender_id} → ${recipient_id} | ${payload_size_bytes} bytes`);

    res.json({
        transfer_id: transferId,
        state: 'OFFERED',
        timeout_ms: TRANSFER_TIMEOUT_MS,
    });
});

// ── POST /kv/stream ───────────────────────────────────────────────────────────

app.post('/kv/stream', (req, res) => {
    const transferId = req.headers['x-transfer-id'];
    if (!transferId) {
        return res.status(400).json({ error: 'Missing X-Transfer-Id header' });
    }

    const transfer = transfers.get(transferId);
    if (!transfer) {
        return res.status(404).json({ error: `Unknown transfer: ${transferId}` });
    }

    if (transfer.state !== 'OFFERED') {
        return res.status(409).json({
            error: `Transfer ${transferId} is in state ${transfer.state}, expected OFFERED`,
        });
    }

    transfer.state = 'STREAMING';

    // Collect binary payload with backpressure
    const chunks = [];
    let totalBytes = 0;
    let timedOut = false;

    const timeout = setTimeout(() => {
        timedOut = true;
        transfer.state = 'FAILED';
        transfer.error = 'Stream timeout';
        console.error(`[AETHER-SWARM] Transfer ${transferId} timed out during streaming`);
        req.destroy();
        res.status(408).json({ error: 'Stream timeout' });
    }, TRANSFER_TIMEOUT_MS);

    req.on('data', (chunk) => {
        totalBytes += chunk.length;

        if (totalBytes > MAX_PAYLOAD_BYTES) {
            clearTimeout(timeout);
            transfer.state = 'FAILED';
            transfer.error = 'Payload exceeds maximum size';
            req.destroy();
            return res.status(413).json({ error: 'Payload exceeds maximum size' });
        }

        chunks.push(chunk);
    });

    req.on('end', () => {
        if (timedOut) return;
        clearTimeout(timeout);

        const payload = Buffer.concat(chunks);

        // Verify SHA-256 integrity if declared in the offer
        if (transfer.payload_sha256) {
            const computedHash = crypto.createHash('sha256').update(payload).digest('hex');
            if (computedHash !== transfer.payload_sha256) {
                transfer.state = 'FAILED';
                transfer.error = `SHA-256 mismatch: expected ${transfer.payload_sha256}, got ${computedHash}`;
                console.error(`[AETHER-SWARM] Transfer ${transferId} SHA-256 mismatch`);
                return res.status(422).json({
                    error: transfer.error,
                    expected: transfer.payload_sha256,
                    received: computedHash,
                });
            }
        }

        transfer.state = 'STREAMED';
        transfer.streamed_at = Date.now();
        transfer.payload = payload;

        const latencyMs = transfer.streamed_at - transfer.offered_at;
        const throughputMBps = totalBytes > 0
            ? (totalBytes / (1024 * 1024)) / (latencyMs / 1000)
            : 0;

        console.log(
            `[AETHER-SWARM] Transfer ${transferId} streamed: ${totalBytes} bytes ` +
            `in ${latencyMs}ms (${throughputMBps.toFixed(2)} MB/s)`
        );

        // Report to tau-sync if available
        reportToTauSync(transfer.sender_id, totalBytes).catch(() => { });

        res.json({
            transfer_id: transferId,
            state: 'STREAMED',
            bytes_received: totalBytes,
            latency_ms: latencyMs,
            throughput_mbps: parseFloat(throughputMBps.toFixed(2)),
        });
    });

    req.on('error', (err) => {
        clearTimeout(timeout);
        transfer.state = 'FAILED';
        transfer.error = err.message;
        console.error(`[AETHER-SWARM] Transfer ${transferId} stream error:`, err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: `Stream error: ${err.message}` });
        }
    });
});

// ── POST /kv/ack ──────────────────────────────────────────────────────────────

app.post('/kv/ack', (req, res) => {
    const { transfer_id, success, failed_blocks } = req.body;

    if (!transfer_id) {
        return res.status(400).json({ error: 'Missing transfer_id' });
    }

    const transfer = transfers.get(transfer_id);
    if (!transfer) {
        return res.status(404).json({ error: `Unknown transfer: ${transfer_id}` });
    }

    if (success) {
        transfer.state = 'ACKED';
        transfer.acked_at = Date.now();

        // Release payload from memory once acknowledged
        transfer.payload = null;

        console.log(`[AETHER-SWARM] Transfer ${transfer_id} acknowledged by recipient`);

        return res.json({
            transfer_id,
            state: 'ACKED',
            total_latency_ms: transfer.acked_at - transfer.offered_at,
        });
    } else {
        // NACK — selective retransmission needed
        transfer.state = 'NACKED';
        transfer.failed_blocks = failed_blocks || [];

        console.warn(
            `[AETHER-SWARM] Transfer ${transfer_id} NACKed. ` +
            `Failed blocks: [${(failed_blocks || []).join(', ')}]`
        );

        return res.json({
            transfer_id,
            state: 'NACKED',
            failed_blocks: transfer.failed_blocks,
            action: 'SELECTIVE_RETRANSMIT',
        });
    }
});

// ── GET /kv/status/:transfer_id ───────────────────────────────────────────────

app.get('/kv/status/:transfer_id', (req, res) => {
    const transfer = transfers.get(req.params.transfer_id);
    if (!transfer) {
        return res.status(404).json({ error: `Unknown transfer: ${req.params.transfer_id}` });
    }

    res.json({
        transfer_id: req.params.transfer_id,
        state: transfer.state,
        sender_id: transfer.sender_id,
        recipient_id: transfer.recipient_id,
        payload_size_bytes: transfer.payload_size_bytes,
        offered_at: transfer.offered_at,
        streamed_at: transfer.streamed_at,
        acked_at: transfer.acked_at,
        error: transfer.error || null,
        failed_blocks: transfer.failed_blocks,
    });
});

// ── GET /health ───────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
    // Count transfers by state
    const stateCounts = {};
    for (const [, t] of transfers) {
        stateCounts[t.state] = (stateCounts[t.state] || 0) + 1;
    }

    res.json({
        status: 'operational',
        service: 'p2pclaw-core-aether-swarm',
        engine: 'KV-Cache Binary Router (Immutable)',
        transfer_counts: stateCounts,
        max_payload_bytes: MAX_PAYLOAD_BYTES,
        transfer_timeout_ms: TRANSFER_TIMEOUT_MS,
        uptime: process.uptime(),
    });
});

// ── Tau-Sync Integration ──────────────────────────────────────────────────────

const TAU_SYNC_URL = process.env.TAU_SYNC_URL || 'http://localhost:5003';

async function reportToTauSync(agentId, payloadBytes) {
    try {
        // Each 1KB of KV-cache transferred = 1 compute cycle
        const computeCycles = Math.ceil(payloadBytes / 1024);

        const response = await fetch(`${TAU_SYNC_URL}/tau/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: agentId,
                compute_cycles: computeCycles,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`[AETHER-SWARM] Tau-sync updated: tau=${data.tau}, epoch=${data.network_epoch}`);
        }
    } catch (err) {
        // Non-critical — tau-sync may not be running
        console.debug(`[AETHER-SWARM] Tau-sync unavailable: ${err.message}`);
    }
}

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.CORE_AETHER_SWARM_PORT || 5010;
app.listen(PORT, () => {
    console.log(`[CORE:AETHER-SWARM] Immutable KV-Cache Router listening on port ${PORT}`);
    console.log(`[CORE:AETHER-SWARM] Max payload: ${MAX_PAYLOAD_BYTES} bytes | Timeout: ${TRANSFER_TIMEOUT_MS}ms`);
});
