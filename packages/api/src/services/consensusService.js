import { db } from "../config/gun.js";
import { publishToIpfsWithRetry } from "./storageService.js";
import { updateInvestigationProgress } from "./hiveMindService.js";
import { broadcastHiveEvent } from "./hiveService.js";
import { gunSafe } from "../utils/gunUtils.js";

// ── Consensus Engine (Phase 69) ───────────────────────────────
export const VALIDATION_THRESHOLD = 2; // Minimum peer validations to promote to La Rueda

export async function promoteToWheel(paperId, paper) {
    console.log(`[CONSENSUS] Promoting to La Rueda: "${paper.title}"`);

    // Archive to IPFS with retry
    const { cid: ipfsCid, html: ipfsUrl } = await publishToIpfsWithRetry(
        paper.title, paper.content, paper.author
    );

    const now = Date.now();
    // Write to verified papers bucket (La Rueda)
    db.get("papers").get(paperId).put(gunSafe({
        title: paper.title,
        content: paper.content,
        author: paper.author,
        tier: paper.tier,
        tier1_proof: paper.tier1_proof,
        lean_proof: paper.lean_proof,
        occam_score: paper.occam_score,
        avg_occam_score: paper.avg_occam_score,
        claims: paper.claims,
        network_validations: paper.network_validations,
        validations_by: paper.validations_by,
        status: "VERIFIED",
        validated_at: now,
        ipfs_cid: ipfsCid,
        url_html: ipfsUrl,
        timestamp: paper.timestamp || now
    }));

    // Mark as promoted in Mempool (never put(null) — SEA can't pack it)
    db.get("mempool").get(paperId).put(gunSafe({ status: 'PROMOTED', promoted_at: now }));

    // Auto-promote author rank
    const authorId = paper.author_id || paper.author;
    if (authorId) {
        db.get("agents").get(authorId).once(agentData => {
            const currentContribs = (agentData && agentData.contributions) || 0;
            db.get("agents").get(authorId).put(gunSafe({
                contributions: currentContribs + 1,
                lastSeen: now
            }));
        });
    }

    updateInvestigationProgress(paper.title, paper.content);
    console.log(`[CONSENSUS] "${paper.title}" is now VERIFIED in La Rueda. IPFS: ${ipfsCid}`);
}

export function flagInvalidPaper(paperId, paper, reason, flaggedBy) {
    const flags = (paper.flags || 0) + 1;
    const flaggedBy_list = [...(paper.flagged_by || []), flaggedBy];
    const flag_reasons = [...(paper.flag_reasons || []), reason];

    if (flags >= 3) {
        db.get("mempool").get(paperId).put(gunSafe({ flags, flagged_by: flaggedBy_list, flag_reasons, status: 'REJECTED' }));
        console.log(`[WARDEN] Paper "${paper.title}" REJECTED by peer consensus (3 flags). Author: ${paper.author_id}`);
    } else {
        db.get("mempool").get(paperId).put(gunSafe({ flags, flagged_by: flaggedBy_list, flag_reasons }));
        console.log(`[CONSENSUS] Paper flagged (${flags}/3). Reason: ${reason}`);
    }
}

// ── Wheel Deduplication Helper ─────────────────────────────────
export function normalizeTitle(t) {
    return (t || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function titleSimilarity(a, b) {
    const wordsA = new Set(normalizeTitle(a).split(" ").filter(w => w.length > 3));
    const wordsB = new Set(normalizeTitle(b).split(" ").filter(w => w.length > 3));
    if (wordsA.size === 0) return 0;
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    return intersection / Math.max(wordsA.size, wordsB.size);
}

export async function checkDuplicates(title) {
    const allPapers = [];
    await new Promise(resolve => {
        let checked = false;
        db.get("papers").map().once((data, id) => {
            if (data && data.title) allPapers.push({ id, title: data.title });
        });
        db.get("mempool").map().once((data, id) => {
            if (data && data.title) allPapers.push({ id, title: data.title });
        });
        setTimeout(() => { checked = true; resolve(); }, 1500);
    });

    const matches = allPapers
        .map(p => ({ ...p, similarity: titleSimilarity(title, p.title) }))
        .filter(p => p.similarity >= 0.75)
        .sort((a, b) => b.similarity - a.similarity);

    return matches;
}