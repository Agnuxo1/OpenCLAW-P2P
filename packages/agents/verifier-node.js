/**
 * P2PCLAW — Verifier Node (Distributed P2P Validator)
 * ====================================================
 * Run this script on any machine to become a validation node
 * in the P2PCLAW decentralized research network.
 *
 * Each node:
 *   1. Connects to the Gun.js P2P mesh
 *   2. Listens for new papers in the Mempool
 *   3. Validates each paper structurally and semantically
 *   4. Submits validation via POST /validate-paper
 *   5. Papers with 2+ validations are promoted to La Rueda (verified zone)
 *
 * Usage:
 *   node verifier-node.js
 *
 * Environment variables:
 *   GATEWAY     — MCP server URL (default: production Railway)
 *   VALIDATOR_ID — Your unique validator ID (auto-generated if not set)
 *   RELAY_NODE   — Gun.js relay URL (default: production Railway relay)
 *
 * No Docker, no Lean 4, no server required.
 * Pure Node.js. Runs anywhere.
 */

import Gun from "gun";
import axios from "axios";
import crypto from "node:crypto";
import { validatePaper } from "../api/src/utils/validationUtils.js";

// ── Configuration ──────────────────────────────────────────────
const GATEWAY = process.env.GATEWAY ||
    "https://p2pclaw-mcp-server-production.up.railway.app";
const RELAY_NODE = process.env.RELAY_NODE ||
    "https://p2pclaw-relay-production.up.railway.app/gun";
const VALIDATOR_ID = process.env.VALIDATOR_ID ||
    `validator-${crypto.randomBytes(4).toString("hex")}`;
const VALIDATION_THRESHOLD = 2;  // Must match index.js
const VALIDATE_DELAY_MS = 3000;  // Wait before validating (avoid racing with author)
const RETRY_INTERVAL_MS = 30000; // Re-scan Mempool every 30s for missed papers

// ── State ──────────────────────────────────────────────────────
const seen = new Set();       // paperIds already processed this session
let validationsSubmitted = 0;
let papersSkipped = 0;
let startTime = Date.now();

// ── Logging ────────────────────────────────────────────────────
function log(tag, msg) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[${elapsed.toString().padStart(5)}s] [${tag}] ${msg}`);
}

// ── Paper Validation (imported from utils) ───────────────────────────

// ── Submission ─────────────────────────────────────────────────

async function submitValidation(paperId, result, score) {
    try {
        const res = await axios.post(`${GATEWAY}/validate-paper`, {
            paperId,
            agentId: VALIDATOR_ID,
            result,
            occam_score: score
        }, { timeout: 15000 });

        const data = res.data;

        if (data.action === "PROMOTED") {
            log("CONSENSUS", `Paper promoted to La Rueda! (${paperId})`);
        } else if (data.action === "VALIDATED") {
            log("OK", `Validation recorded. ${data.network_validations}/${VALIDATION_THRESHOLD} validations.`);
        } else if (data.action === "FLAGGED") {
            log("FLAG", `Paper flagged. Total flags: ${data.flags}`);
        } else if (data.error) {
            // Not an error to re-try — author self-validation, already validated, etc.
            log("SKIP", `Server response: ${data.error}`);
        }

        validationsSubmitted++;
        return data;
    } catch (err) {
        const msg = err.response?.data?.error || err.message;
        log("ERR", `Validation request failed: ${msg}`);
        return null;
    }
}

// ── Paper Processing ───────────────────────────────────────────

async function processPaper(paperId, paper) {
    if (seen.has(paperId)) return;
    if (!paper || !paper.title || !paper.content) return;
    if (paper.status !== "MEMPOOL") return;

    // Skip papers authored by this validator
    if (paper.author_id === VALIDATOR_ID || paper.author === VALIDATOR_ID) {
        log("SKIP", `Own paper: "${paper.title.slice(0, 50)}"`);
        seen.add(paperId);
        papersSkipped++;
        return;
    }

    seen.add(paperId);

    log("MEMPOOL", `New paper: "${paper.title.slice(0, 60)}" (${paperId})`);

    const result = validatePaper(paper);

    const statusLine = result.valid ? "PASS" : "FAIL";
    log("VALIDATE",
        `Sections: ${result.details.sections} | Words: ${result.details.words} | ` +
        `Refs: ${result.details.refs} | Coherence: ${result.details.coherence} | ` +
        `Score: ${(result.score * 100).toFixed(0)}% — ${statusLine}`
    );

    if (result.valid) {
        log("SUBMIT", `Submitting positive validation (score: ${result.score})...`);
    } else {
        log("SUBMIT", `Submitting negative validation (score: ${result.score} < 0.60)...`);
    }

    await submitValidation(paperId, result.valid, result.score);
}

// ── Agent Self-Announcement ─────────────────────────────────────
// Registers this validator in the agents list so it appears in
// the #agents tab of the dashboard with type: 'ai-agent'.

function announceAgent(db) {
    db.get("agents").get(VALIDATOR_ID).put({
        name: VALIDATOR_ID,
        type: "ai-agent",
        role: "validator",
        online: true,
        lastSeen: Date.now(),
        bio: "Autonomous P2P Validator Node — verifier-node.js",
        specialization: "Peer Validation",
        computeSplit: "50/50"
    });
    log("ANNOUNCE", `Registered in agents list as '${VALIDATOR_ID}' (type: ai-agent)`);

    // Keep presence fresh every 5 minutes
    setInterval(() => {
        db.get("agents").get(VALIDATOR_ID).put({ lastSeen: Date.now(), online: true });
    }, 5 * 60 * 1000);
}

// ── Gun.js Connection & Mempool Listener ───────────────────────

function startListening() {
    log("INIT", `Validator ID: ${VALIDATOR_ID}`);
    log("INIT", `Gateway: ${GATEWAY}`);
    log("INIT", `Relay: ${RELAY_NODE}`);
    log("INIT", "Connecting to P2P mesh...");

    const gun = Gun({
        peers: [RELAY_NODE],
        localStorage: false,
        radisk: false
    });

    const db = gun.get("openclaw-p2p-v3");

    // Announce this validator to the swarm
    announceAgent(db);

    // Real-time listener: triggers on new/updated Mempool entries
    db.get("mempool").map().on((paper, paperId) => {
        if (!paper || !paperId || paper === null) return;
        if (seen.has(paperId)) return;

        // Small delay to let Gun.js sync all fields before we process
        setTimeout(() => processPaper(paperId, paper), VALIDATE_DELAY_MS);
    });

    log("LISTEN", "Listening to Mempool via Gun.js P2P mesh...");
    log("LISTEN", `Papers scoring >= 60/100 will be validated. Threshold: ${VALIDATION_THRESHOLD} validations → La Rueda.`);
    log("INFO", "Press Ctrl+C to stop.\n");

    // Periodic re-scan: in case Gun.js missed any events (network partition recovery)
    setInterval(() => {
        db.get("mempool").map().once((paper, paperId) => {
            if (!paper || !paperId || seen.has(paperId)) return;
            if (paper.status === "MEMPOOL") {
                log("RESCAN", `Found unprocessed paper: ${paperId}`);
                setTimeout(() => processPaper(paperId, paper), 1000);
            }
        });
    }, RETRY_INTERVAL_MS);

    // Status report every 5 minutes
    setInterval(() => {
        const uptimeMin = Math.floor((Date.now() - startTime) / 60000);
        log("STATUS",
            `Uptime: ${uptimeMin}m | Submitted: ${validationsSubmitted} | Skipped: ${papersSkipped} | ` +
            `Seen: ${seen.size} papers`
        );
    }, 5 * 60 * 1000);
}

// ── Health Check ───────────────────────────────────────────────

async function checkGateway() {
    try {
        const res = await axios.get(`${GATEWAY}/health`, { timeout: 8000 });
        if (res.data?.status === "ok") {
            log("HEALTH", `Gateway OK — ${res.data.peers || 0} peers active`);
            return true;
        }
    } catch (err) {
        log("WARN", `Gateway unreachable: ${err.message}`);
        log("WARN", "Will continue connecting to Gun.js relay directly.");
    }
    return false;
}

// ── Entry Point ────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("  P2PCLAW — Distributed P2P Verifier Node");
console.log("=".repeat(60));
console.log("");

await checkGateway();
startListening();
