/**
 * Neural Inference Service — AirLLM × tinygrad Orchestration Layer
 * =================================================================
 * Production-grade Node.js service managing:
 *   • Python bridge lifecycle (spawn / connect / health-poll)
 *   • Priority job queue (P0–P3, sequential GPU-bound execution)
 *   • Backend selection delegation (auto / airllm / tinygrad)
 *   • Per-request telemetry → GunDB
 *   • Mesh announcements so peers discover local inference nodes
 */

import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";
import { broadcastHiveEvent } from "./hiveService.js";

// ── Configuration ────────────────────────────────────────────────────────

const BRIDGE_URL = process.env.AIRLLM_BRIDGE_URL || "http://127.0.0.1:5050";
const HEALTH_POLL_MS = 30_000;
const MAX_QUEUE_SIZE = 64;
const JOB_TTL_MS = 10 * 60 * 1000; // 10 min expiry for stale jobs

// ── Priority levels ──────────────────────────────────────────────────────

const PRIORITY = Object.freeze({
    CONSCIOUSNESS: 0,  // Hive consciousness reflection
    RESEARCH: 1,       // Paper generation / analysis
    AGENT_QUERY: 2,    // Interactive agent queries
    BACKGROUND: 3,     // Background tasks
});

// ── Internal State ───────────────────────────────────────────────────────

let bridgeOnline = false;
let bridgeInfo = null;
let healthPollTimer = null;

// Job queue — sorted by priority then FIFO
const jobQueue = [];
const jobResults = new Map();   // jobId → result
let isProcessing = false;
let jobCounter = 0;

// Telemetry accumulator
const telemetry = {
    totalRequests: 0,
    totalTokens: 0,
    avgLatencyS: 0,
    backendUsage: { airllm: 0, tinygrad: 0 },
    errors: 0,
    since: Date.now(),
};

// ── Bridge Communication ─────────────────────────────────────────────────

async function bridgeFetch(path, options = {}) {
    const url = `${BRIDGE_URL}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 120_000);

    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
        return data;
    } finally {
        clearTimeout(timeout);
    }
}

// ── Health Monitoring ────────────────────────────────────────────────────

async function pollHealth() {
    try {
        const info = await bridgeFetch("/health", { timeout: 5000 });
        const wasOffline = !bridgeOnline;
        bridgeOnline = true;
        bridgeInfo = info;

        if (wasOffline) {
            console.log(`[INFERENCE] Bridge ONLINE at ${BRIDGE_URL}`);
            broadcastHiveEvent("inference_bridge_online", {
                url: BRIDGE_URL,
                backends: info.backends,
            });

            // Announce to mesh
            db.get("airllm_nodes").get(process.env.AGENT_ID || "local").put(gunSafe({
                url: BRIDGE_URL,
                backends: JSON.stringify(info.backends),
                models: JSON.stringify(info.models_loaded),
                online: true,
                lastSeen: Date.now(),
            }));
        }
    } catch {
        if (bridgeOnline) {
            console.warn(`[INFERENCE] Bridge OFFLINE — ${BRIDGE_URL}`);
            bridgeOnline = false;
            bridgeInfo = null;

            db.get("airllm_nodes").get(process.env.AGENT_ID || "local").put(gunSafe({
                online: false,
                lastSeen: Date.now(),
            }));
        }
    }
}

function startHealthPoller() {
    if (healthPollTimer) return;
    pollHealth();
    healthPollTimer = setInterval(pollHealth, HEALTH_POLL_MS);
    console.log(`[INFERENCE] Health poller started (${HEALTH_POLL_MS / 1000}s interval)`);
}

function stopHealthPoller() {
    if (healthPollTimer) {
        clearInterval(healthPollTimer);
        healthPollTimer = null;
    }
}

// ── Job Queue ────────────────────────────────────────────────────────────

function createJobId() {
    return `inf-${Date.now()}-${++jobCounter}`;
}

function enqueueJob(prompt, options = {}) {
    if (jobQueue.length >= MAX_QUEUE_SIZE) {
        throw new Error("JOB_QUEUE_FULL");
    }

    const jobId = createJobId();
    const job = {
        id: jobId,
        prompt,
        backend: options.backend || "auto",
        max_new_tokens: options.max_new_tokens || 64,
        temperature: options.temperature || 1.0,
        top_k: options.top_k || 50,
        top_p: options.top_p || 0.95,
        priority: options.priority ?? PRIORITY.AGENT_QUERY,
        status: "queued",
        createdAt: Date.now(),
        model_id: options.model_id,
    };

    jobQueue.push(job);
    jobQueue.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

    jobResults.set(jobId, { status: "queued", position: jobQueue.indexOf(job) });

    // Kick processor
    processQueue();

    return jobId;
}

async function processQueue() {
    if (isProcessing || jobQueue.length === 0) return;
    if (!bridgeOnline) return;

    isProcessing = true;

    while (jobQueue.length > 0) {
        const job = jobQueue.shift();

        // Skip expired jobs
        if (Date.now() - job.createdAt > JOB_TTL_MS) {
            jobResults.set(job.id, { status: "expired" });
            continue;
        }

        jobResults.set(job.id, { status: "processing", startedAt: Date.now() });

        try {
            const result = await bridgeFetch("/generate", {
                method: "POST",
                body: JSON.stringify({
                    prompt: job.prompt,
                    backend: job.backend,
                    max_new_tokens: job.max_new_tokens,
                    temperature: job.temperature,
                    top_k: job.top_k,
                    top_p: job.top_p,
                }),
            });

            jobResults.set(job.id, {
                status: "completed",
                result,
                completedAt: Date.now(),
            });

            // Telemetry
            recordTelemetry(result);

            // Announce completion
            broadcastHiveEvent("inference_completed", {
                jobId: job.id,
                backend: result.backend,
                tokens: result.tokens_generated,
                latency_s: result.latency_s,
            });

        } catch (err) {
            jobResults.set(job.id, {
                status: "failed",
                error: err.message,
                failedAt: Date.now(),
            });
            telemetry.errors++;
        }
    }

    isProcessing = false;
}

function getJobResult(jobId) {
    return jobResults.get(jobId) || { status: "not_found" };
}

// ── Telemetry ────────────────────────────────────────────────────────────

function recordTelemetry(result) {
    telemetry.totalRequests++;
    telemetry.totalTokens += result.tokens_generated || 0;

    const backend = result.backend || "unknown";
    telemetry.backendUsage[backend] = (telemetry.backendUsage[backend] || 0) + 1;

    // Running average latency
    const n = telemetry.totalRequests;
    telemetry.avgLatencyS = ((telemetry.avgLatencyS * (n - 1)) + (result.latency_s || 0)) / n;

    // Persist to GunDB periodically (every 10 requests)
    if (n % 10 === 0) {
        db.get("airllm_telemetry").put(gunSafe({
            totalRequests: telemetry.totalRequests,
            totalTokens: telemetry.totalTokens,
            avgLatencyS: Math.round(telemetry.avgLatencyS * 1000) / 1000,
            backendUsage: JSON.stringify(telemetry.backendUsage),
            errors: telemetry.errors,
            since: telemetry.since,
            updatedAt: Date.now(),
        }));
    }
}

function getTelemetry() {
    return {
        ...telemetry,
        queueDepth: jobQueue.length,
        isProcessing,
        bridgeOnline,
    };
}

// ── Cleanup stale jobs ───────────────────────────────────────────────────

setInterval(() => {
    const now = Date.now();
    for (const [id, result] of jobResults) {
        const age = now - (result.completedAt || result.failedAt || result.startedAt || now);
        if (age > JOB_TTL_MS) {
            jobResults.delete(id);
        }
    }
}, 60_000);

// ── Public API ───────────────────────────────────────────────────────────

export const inferenceService = {
    PRIORITY,

    /** Initialise the service — start health poller. */
    initialize() {
        startHealthPoller();
        console.log("[INFERENCE] Neural Inference Service initialised.");
    },

    /** Shutdown gracefully. */
    shutdown() {
        stopHealthPoller();
    },

    /** Bridge health + loaded models. */
    async getStatus() {
        if (!bridgeOnline) {
            return { bridge: "offline", url: BRIDGE_URL };
        }
        try {
            return await bridgeFetch("/health", { timeout: 5000 });
        } catch {
            return { bridge: "error", url: BRIDGE_URL };
        }
    },

    /** List available backends and capabilities. */
    async getBackends() {
        if (!bridgeOnline) return { backends: [], bridge: "offline" };
        return bridgeFetch("/backends", { timeout: 5000 });
    },

    /** List loaded models. */
    async getModels() {
        if (!bridgeOnline) return { models: [], bridge: "offline" };
        return bridgeFetch("/models", { timeout: 5000 });
    },

    /** Load a model onto a backend. */
    async loadModel(modelId, options = {}) {
        if (!bridgeOnline) throw new Error("BRIDGE_OFFLINE");

        const result = await bridgeFetch("/load", {
            method: "POST",
            body: JSON.stringify({
                model_id: modelId,
                backend: options.backend || "auto",
                compression: options.compression || null,
                max_seq_len: options.max_seq_len || 128,
                hf_token: options.hf_token || null,
            }),
        });

        broadcastHiveEvent("inference_model_loaded", {
            model_id: modelId,
            backend: result.backend,
        });

        // Announce to mesh
        db.get("airllm_nodes").get(process.env.AGENT_ID || "local").put(gunSafe({
            models: JSON.stringify({ [result.backend]: modelId }),
            lastSeen: Date.now(),
        }));

        return result;
    },

    /** Submit an inference job.  Returns job ID for polling. */
    submitJob(prompt, options = {}) {
        if (!bridgeOnline) throw new Error("BRIDGE_OFFLINE");
        return enqueueJob(prompt, options);
    },

    /** Poll a job for its result. */
    getJobResult(jobId) {
        return getJobResult(jobId);
    },

    /** Run a benchmark. */
    async benchmark(options = {}) {
        if (!bridgeOnline) throw new Error("BRIDGE_OFFLINE");
        return bridgeFetch("/benchmark", {
            method: "POST",
            body: JSON.stringify({
                backend: options.backend || "auto",
                prompt: options.prompt || "The meaning of life is",
                max_new_tokens: options.max_new_tokens || 32,
                runs: options.runs || 3,
            }),
        });
    },

    /** Unload model from a backend. */
    async unload(backend = "all") {
        if (!bridgeOnline) throw new Error("BRIDGE_OFFLINE");
        return bridgeFetch("/unload", {
            method: "POST",
            body: JSON.stringify({ backend }),
        });
    },

    /** Get VRAM info. */
    async getVRAM() {
        if (!bridgeOnline) return { type: "bridge_offline" };
        return bridgeFetch("/vram", { timeout: 5000 });
    },

    /** Get aggregated telemetry. */
    getTelemetry,
};
