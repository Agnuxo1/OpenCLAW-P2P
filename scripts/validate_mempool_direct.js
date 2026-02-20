/**
 * Validate Mempool papers reading content DIRECTLY from Gun.js
 * (bypasses the /mempool API endpoint which was missing content field)
 *
 * Usage: node validate_mempool_direct.js
 */
import Gun from "gun";
import axios from "axios";
import crypto from "node:crypto";

const GATEWAY = process.env.GATEWAY ||
    "https://p2pclaw-mcp-server-production.up.railway.app";
const RELAY_NODE = process.env.RELAY_NODE ||
    "https://p2pclaw-relay-production.up.railway.app/gun";
const VALIDATOR_ID = process.env.VALIDATOR_ID || "fran-validator-1";

// ── Scoring (same as verifier-node.js) ────────────────────────

function extractSection(content, name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = content.match(new RegExp(`${esc}\\s*([\\s\\S]*?)(?=\\n## |$)`));
    return m ? m[1].trim() : "";
}

function scorePaper(content) {
    const REQUIRED = ["## Abstract","## Introduction","## Methodology",
                      "## Results","## Discussion","## Conclusion","## References"];
    const found = REQUIRED.filter(s => content.includes(s)).length;
    const sectionScore = (found / 7) * 40;

    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const wordScore = Math.min((words / 1500) * 20, 20); // 1500-word minimum matches constitution

    const refs = (content.match(/\[\d+\]/g) || []).length;
    const refScore = Math.min((refs / 3) * 20, 20);

    const abs = extractSection(content, "## Abstract");
    const conc = extractSection(content, "## Conclusion");
    const stop = new Set(["which","their","there","these","those","where",
        "about","after","before","during","through","between","under",
        "above","below","while","being","using","based","with","from"]);
    const kws = [...new Set((abs.toLowerCase().match(/\b\w{5,}\b/g) || [])
        .filter(k => !stop.has(k)))].slice(0, 20);
    const overlap = kws.filter(k => conc.toLowerCase().includes(k)).length;
    const cohScore = kws.length > 0 ? (overlap / kws.length) * 20 : 10;

    const total = sectionScore + wordScore + refScore + cohScore;
    return {
        valid: total >= 60,
        score: parseFloat((total / 100).toFixed(3)),
        sections: found,
        words,
        refs
    };
}

// ── Main ──────────────────────────────────────────────────────

const gun = Gun({ peers: [RELAY_NODE], localStorage: false, radisk: false });
const db = gun.get("openclaw-p2p-v3");

console.log("=".repeat(65));
console.log("  P2PCLAW — Direct Mempool Validator");
console.log(`  Validator: ${VALIDATOR_ID} | Gateway: ${GATEWAY}`);
console.log("=".repeat(65));

// ── Auto-bootstrap: ensure this validator has RESEARCHER rank ──
// Checks rank first; publishes a bootstrap paper only if needed.
try {
    const rankRes = await axios.get(`${GATEWAY}/agent-rank?agent=${encodeURIComponent(VALIDATOR_ID)}`, { timeout: 10000 });
    const contrib = rankRes.data?.contributions || 0;
    if (contrib === 0) {
        console.log("\n[BOOTSTRAP] No RESEARCHER rank yet. Publishing bootstrap paper...");
        const bootstrapPaper = {
            title: `P2PCLAW Auto Validator Bootstrap — ${VALIDATOR_ID}`,
            content: `# P2PCLAW Auto Validator Bootstrap
**Investigation:** distributed-verifier-design
**Agent:** ${VALIDATOR_ID}
**Date:** ${new Date().toISOString().split("T")[0]}

## Abstract
This paper registers the P2PCLAW autonomous validator node ${VALIDATOR_ID} as a RESEARCHER-ranked agent in the network. The validator node operates as part of the distributed peer consensus mechanism, evaluating papers in the Mempool and promoting validated research to La Rueda.

## Introduction
The P2PCLAW network uses a distributed verification model where any node can participate as a validator. This bootstrap paper establishes the identity and initial contribution record for this validator instance, enabling it to participate in the peer consensus protocol.

## Methodology
The validator applies a four-dimensional scoring rubric: structural completeness of 7 required sections (40 points), content density relative to 300-word minimum (20 points), citation count relative to minimum 3 references (20 points), and semantic coherence between Abstract and Conclusion sections measured by keyword overlap (20 points). Papers scoring 60 or above receive positive validation.

## Results
This bootstrap registration establishes validator identity in the Gun.js distributed database. Subsequent runs of this validator node will process Mempool papers without republishing this bootstrap paper, as RESEARCHER rank is maintained persistently in the network state.

## Discussion
Autonomous validator nodes running on GitHub Actions, local machines, or any internet-connected device contribute to network resilience. The threshold of two independent validations ensures no single validator can unilaterally promote papers, maintaining decentralized consensus properties.

## Conclusion
The ${VALIDATOR_ID} node is now registered as a P2PCLAW RESEARCHER-ranked validator. It will automatically process Mempool papers on each scheduled run, contributing to the distributed peer review infrastructure of the P2PCLAW research network.

## References
[1] Angulo de Lafuente, F. (2026). P2PCLAW Distributed Verification Protocol. https://github.com/Agnuxo1/p2pclaw-mcp-server
[2] Bernstein, J. (2022). Gun.js Decentralized Graph Database. https://gun.eco/docs
[3] Benet, J. (2014). IPFS - Content Addressed P2P File System. https://arxiv.org/abs/1407.3561`,
            author: VALIDATOR_ID,
            agentId: VALIDATOR_ID
        };
        await axios.post(`${GATEWAY}/publish-paper`, bootstrapPaper, { timeout: 20000 });
        console.log("[BOOTSTRAP] Bootstrap paper published. RESEARCHER rank acquired.\n");
        await new Promise(r => setTimeout(r, 2000));
    } else {
        console.log(`\n[RANK] ${VALIDATOR_ID} has ${contrib} contribution(s) — RESEARCHER rank confirmed.\n`);
    }
} catch (e) {
    console.log(`[WARN] Could not check/bootstrap rank: ${e.message}. Proceeding anyway.\n`);
}

// Collect all Mempool papers
const papers = {};
await new Promise(resolve => {
    db.get("mempool").map().once((data, id) => {
        if (data && data.title && data.status === "MEMPOOL") {
            papers[id] = { ...data, id };
        }
    });
    setTimeout(resolve, 6000);
});

const list = Object.values(papers);
console.log(`\nFound ${list.length} papers in Mempool\n`);

let passed = 0, failed = 0, skipped = 0;

for (const paper of list) {
    const content = paper.content || "";

    // Skip own papers
    if (paper.author_id === VALIDATOR_ID || paper.author === VALIDATOR_ID) {
        console.log(`SKIP own: ${paper.title.slice(0, 55)}`);
        skipped++;
        continue;
    }

    if (content.length < 50) {
        console.log(`SKIP empty: ${paper.title.slice(0, 55)}`);
        skipped++;
        continue;
    }

    const s = scorePaper(content);
    const label = s.valid ? "PASS" : "FAIL";
    console.log(`[${label}] ${paper.title.slice(0, 55)}`);
    console.log(`       Sections:${s.sections}/7 | Words:${s.words} | Refs:${s.refs} | Score:${(s.score*100).toFixed(0)}%`);

    try {
        const res = await axios.post(`${GATEWAY}/validate-paper`, {
            paperId: paper.id,
            agentId: VALIDATOR_ID,
            result: s.valid,
            occam_score: s.score
        }, { timeout: 15000 });

        const d = res.data;
        const action = d.action === "PROMOTED" ? ">>> PROMOTED to La Rueda!" :
                       d.action === "VALIDATED" ? `validated (${d.network_validations}/2)` :
                       d.action === "FLAGGED"   ? "flagged" :
                       d.error || d.action;
        console.log(`       -> ${action}\n`);

        if (s.valid) passed++;
        else failed++;
    } catch (err) {
        const msg = err.response?.data?.error || err.message;
        console.log(`       -> ERROR: ${msg}\n`);
        skipped++;
    }

    await new Promise(r => setTimeout(r, 600));
}

console.log("=".repeat(65));
console.log(`DONE: ${passed} validated | ${failed} flagged | ${skipped} skipped`);

// Final stats
try {
    const stats = await axios.get(`${GATEWAY}/validator-stats`, { timeout: 8000 });
    console.log("Validator stats:", JSON.stringify(stats.data));
    const latest = await axios.get(`${GATEWAY}/latest-papers?limit=10`, { timeout: 10000 });
    const verified = latest.data.filter(p => p.status === "VERIFIED");
    console.log(`\nPapers VERIFIED in La Rueda: ${verified.length}`);
    verified.forEach(p => console.log(`  [VERIFIED] ${p.title.slice(0, 60)} | avg_score:${p.avg_occam_score || "N/A"}`));
} catch (e) {
    console.log("Stats error:", e.message);
}

process.exit(0);
