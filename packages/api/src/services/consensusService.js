import { db } from "../config/gun.js";
import { publishToIpfsWithRetry } from "./storageService.js";
import { updateInvestigationProgress } from "./hiveMindService.js";
import { broadcastHiveEvent } from "./hiveService.js";
import { gunSafe } from "../utils/gunUtils.js";
import crypto from 'crypto';

// â”€â”€ Consensus Engine (Phase 69) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const VALIDATION_THRESHOLD = 2; // Minimum peer validations to promote to La Rueda

export async function promoteToWheel(paperId, paper) {
    console.log(`[CONSENSUS] Promoting to La Rueda: "${paper.title}"`);

    // VERSION CONTROL (Phase 2)
    // Find parent paper if any (based on title normalize)
    const parentId = paper.parent_id || null;
    let version = 1;
    if (parentId) {
        await new Promise(resolve => {
            db.get("p2pclaw_papers_v4").get(parentId).once(parent => {
                if (parent && parent.version) version = (parent.version || 1) + 1;
                resolve();
            });
        });
    }

    const now = Date.now();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // CRITICAL FIX: Write paper to 'papers' store FIRST, BEFORE IPFS.
    // Previously, if IPFS failed, the entire promotion crashed and the
    // paper stayed stuck in mempool forever. Now the paper is saved to
    // the verified store immediately, and IPFS archiving is non-blocking.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    db.get("p2pclaw_papers_v4").get(paperId).put(gunSafe({
        title: paper.title,
        content: paper.content,
        author: paper.author,
        parent_id: parentId,
        version: version,
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
        ipfs_cid: null,
        url_html: null,
        timestamp: paper.timestamp || now
    }));

    // Mark as promoted in Mempool (never put(null) â€” SEA can't pack it)
    db.get("p2pclaw_mempool_v4").get(paperId).put(gunSafe({ status: 'PROMOTED', promoted_at: now }));

    // Non-blocking IPFS archiving â€” try but never crash the promotion
    try {
        const { cid: ipfsCid, html: ipfsUrl } = await publishToIpfsWithRetry(
            paper.title, paper.content, paper.author
        );
        if (ipfsCid) {
            db.get("p2pclaw_papers_v4").get(paperId).put(gunSafe({ ipfs_cid: ipfsCid, url_html: ipfsUrl }));
            console.log(`[CONSENSUS] IPFS archive OK: ${ipfsCid}`);
        }
    } catch (ipfsErr) {
        console.warn(`[CONSENSUS] IPFS archive failed for "${paper.title}" â€” paper is still VERIFIED in DB. Error: ${ipfsErr.message}`);
    }

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
        db.get("p2pclaw_mempool_v4").get(paperId).put(gunSafe({ flags, flagged_by: flaggedBy_list, flag_reasons, status: 'DENIED' }));
        console.log(`[WARDEN] Paper "${paper.title}" DENIED by peer consensus (3 flags). Author: ${paper.author_id}`);
    } else {
        db.get("p2pclaw_mempool_v4").get(paperId).put(gunSafe({ flags, flagged_by: flaggedBy_list, flag_reasons }));
        console.log(`[CONSENSUS] Paper flagged (${flags}/3). Reason: ${reason}`);
    }
}

// â”€â”€ Wheel Deduplication Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function normalizeTitle(t) {
    return (t || "")
        .toLowerCase()
        // Strip author attribution suffixes: "[Contribution by Dr. X Y]", "[by X]", etc.
        .replace(/\[contribution by[^\]]*\]/gi, "")
        .replace(/\[by [^\]]*\]/gi, "")
        .replace(/\s*-\s*contribution by.*$/i, "")
        .replace(/\s*by dr\.?\s+\w+(\s+\w+)?$/i, "")
        // Strip all punctuation and normalize spaces
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function titleSimilarity(a, b) {
    const wordsA = new Set(normalizeTitle(a).split(" ").filter(w => w.length > 3));
    const wordsB = new Set(normalizeTitle(b).split(" ").filter(w => w.length > 3));
    if (wordsA.size === 0) return 0;
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    return intersection / Math.max(wordsA.size, wordsB.size);
}

// â”€â”€ In-memory exact-title cache (survives within process lifetime) â”€â”€
// Populated on startup from Gun.js and updated on every new publish.
// MAX_CACHE_SIZE prevents unbounded memory growth in long-running processes.
const MAX_CACHE_SIZE = 8000;

export const titleCache = new Set(); // stores normalizeTitle(title) strings
export const wordCountCache = new Set(); // stores exact word counts (Number)
export const contentHashCache = new Set(); // stores normalized content hashes

/** Add to a bounded Set â€” evicts oldest entries when limit is reached. */
function boundedAdd(set, value) {
    if (set.size >= MAX_CACHE_SIZE) {
        const first = set.values().next().value;
        set.delete(first);
    }
    set.add(value);
}

// â”€â”€ Persistent Title Registry (Phase 70: Auto-Deduplication) â”€â”€
const registry = db.get("registry/titles");
const wordCountRegistry = db.get("registry/wordcounts");
const contentHashRegistry = db.get("registry/contenthashes");

// Hydrate title cache ONCE at startup â€” titles only, NO content loading.
// Loading full paper content at boot caused OOM in Railway (400MB+ from Gun.js peer sync).
// Content hash dedup is handled live via checkHashDeep() which queries Gun.js on demand.
setTimeout(() => {
    db.get("p2pclaw_papers_v4").map().once((data) => {
        if (!data || !data.title) return;
        boundedAdd(titleCache, normalizeTitle(data.title));
        // Also seed abstract hash cache from stored hash (not raw content)
        if (data.abstract_hash) boundedAdd(abstractHashCache, data.abstract_hash);
    });
    db.get("p2pclaw_mempool_v4").map().once((data) => {
        if (!data || data.status !== 'MEMPOOL' || !data.title) return;
        boundedAdd(titleCache, normalizeTitle(data.title));
        if (data.abstract_hash) boundedAdd(abstractHashCache, data.abstract_hash);
    });
}, 5000); // 5s after boot â€” let Gun.js connect before seeding

/** Synchronous exact-match check against in-memory cache. O(1). */
export function titleExistsExact(title) {
    const norm = normalizeTitle(title);
    return titleCache.has(norm);
}

/** Synchronous exact word count check. */
export function wordCountExistsExact(wc) {
    return wordCountCache.has(Number(wc));
}

export function contentHashExists(content) {
    const hash = getContentHash(content);
    return contentHashCache.has(hash);
}

export function getContentHash(content) {
    // Strip metadata headers AND author attribution patterns that spammers rotate
    const normalized = (content || "")
        // Strip metadata headers
        .replace(/\*\*Agent:\*\*.*?\n/g, "")
        .replace(/\*\*Date:\*\*.*?\n/g, "")
        .replace(/\*\*Investigation:\*\*.*?\n/g, "")
        .replace(/\*\*Author:\*\*.*?\n/g, "")
        // Strip author name patterns: "Dr. Firstname Lastname", "Prof. X", "[Contribution by ...]"
        .replace(/\[Contribution by[^\]]*\]/gi, "")
        .replace(/\[by [^\]]*\]/gi, "")
        .replace(/Dr\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        .replace(/Prof\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        // Strip title lines that often contain author names
        .replace(/^#+\s.*\[.*\].*$/gm, "")
        // Normalize whitespace and case
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Compute a hash of only the Abstract section of a paper.
 * This is the most stable part â€” less likely to contain author name variations.
 */
export function getAbstractHash(content) {
    const text = content || "";
    // Extract content between ## Abstract and the next ## section
    const match = text.match(/##\s*Abstract\s*([\s\S]*?)(?=##|\n---|\n\*\*|$)/i);
    const abstract = match ? match[1].trim() : text.slice(0, 800);
    const normalized = abstract
        .replace(/Dr\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        .replace(/Prof\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
    // Only hash if long enough to be meaningful
    if (normalized.length < 50) return null;
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/** 
 * Proactively check if a title exists in the persistent registry.
 * Used for deep verification before rejection.
 */
export async function checkRegistryDeep(title) {
    const norm = normalizeTitle(title);
    return new Promise(resolve => {
        registry.get(norm).once(data => resolve(data || null));
        setTimeout(() => resolve(null), 1000);
    });
}

/** Proactively check if a word count exists in the persistent registry. */
export async function checkWordCountDeep(wc) {
    return new Promise(resolve => {
        wordCountRegistry.get(wc.toString()).once(data => resolve(data || null));
        setTimeout(() => resolve(null), 1000);
    });
}

export async function checkHashDeep(content) {
    const hash = getContentHash(content);
    return new Promise(resolve => {
        contentHashRegistry.get(hash).once(data => resolve(data || null));
        setTimeout(() => resolve(null), 1000);
    });
}


export async function checkDuplicates(title) {
    const allPapers = [];
    await new Promise(resolve => {
        db.get("p2pclaw_papers_v4").map().once((data, id) => {
            if (data && data.title) allPapers.push({ id, title: data.title });
        });
        db.get("p2pclaw_mempool_v4").map().once((data, id) => {
            if (data && data.title && data.status !== 'DENIED') {
                allPapers.push({ id, title: data.title });
            }
        });
        setTimeout(resolve, 1500);
    });

    // Lower thresholds: 0.65+ = hard block (was 0.80), 0.50+ = log warning (was 0.75)
    const matches = allPapers
        .map(p => ({ ...p, similarity: titleSimilarity(title, p.title) }))
        .filter(p => p.similarity >= 0.50)
        .sort((a, b) => b.similarity - a.similarity);

    return matches;
}

/**
 * Check if a paper with the same investigation_id AND similar title already exists.
 * This is the primary protection against the "[Contribution by Dr. X]" spam pattern.
 */
export async function checkInvestigationDuplicate(investigationId, title) {
    if (!investigationId) return null;
    const normTitle = normalizeTitle(title);

    return new Promise(resolve => {
        let found = null;
        db.get("p2pclaw_mempool_v4").map().once((data, id) => {
            if (found) return;
            if (data && data.investigation_id === investigationId && data.status !== 'DENIED') {
                const sim = titleSimilarity(data.title || "", title);
                if (sim >= 0.55) {
                    found = { paperId: id, title: data.title, similarity: sim, status: data.status };
                }
            }
        });
        db.get("p2pclaw_papers_v4").map().once((data, id) => {
            if (found) return;
            if (data && data.investigation_id === investigationId) {
                const sim = titleSimilarity(data.title || "", title);
                if (sim >= 0.55) {
                    found = { paperId: id, title: data.title, similarity: sim, status: 'VERIFIED' };
                }
            }
        });
        setTimeout(() => resolve(found), 1500);
    });
}

/** In-memory abstract hash cache for fast lookup within a session */
export const abstractHashCache = new Set();

export function abstractHashExists(content) {
    const hash = getAbstractHash(content);
    if (!hash) return false;
    return abstractHashCache.has(hash);
}

export async function checkAbstractHashDeep(content) {
    const hash = getAbstractHash(content);
    if (!hash) return null;
    return new Promise(resolve => {
        db.get("registry/abstracthashes").get(hash).once(data => resolve(data || null));
        setTimeout(() => resolve(null), 1000);
    });
}
