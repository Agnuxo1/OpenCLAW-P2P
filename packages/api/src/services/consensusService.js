import { db } from "../config/gun.js";
import { publishToIpfsWithRetry, archiveToArweave } from "./storageService.js";
import { registerPaperOnChain } from "./blockchainRegistryService.js";
import { updateInvestigationProgress } from "./hiveMindService.js";
import { broadcastHiveEvent } from "./hiveService.js";
import { gunSafe } from "../utils/gunUtils.js";
import { gunCollect, gunOnce } from "../utils/gunCollect.js";
import crypto from 'crypto';

// Consensus Engine (Phase 69)
export const VALIDATION_THRESHOLD = 2; // Minimum peer validations to promote to La Rueda

export async function promoteToWheel(paperId, paper) {
    console.log(`[CONSENSUS] Promoting to La Rueda: "${paper.title}"`);

    // VERSION CONTROL (Phase 2)
    const parentId = paper.parent_id || null;
    let version = 1;
    if (parentId) {
        // B1 fix: Replace setTimeout with gunOnce
        const parent = await gunOnce(db.get("p2pclaw_papers_v4").get(parentId));
        if (parent && parent.version) version = (parent.version || 1) + 1;
    }

    const now = Date.now();

    // CRITICAL FIX: Write paper to 'papers' store FIRST, BEFORE IPFS.
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

    // Mark as promoted in Mempool
    db.get("p2pclaw_mempool_v4").get(paperId).put(gunSafe({ status: 'PROMOTED', promoted_at: now }));

    // Non-blocking Arweave archiving
    let arweaveTxId = null;
    try {
        arweaveTxId = await archiveToArweave(paper.content, paperId);
        if (arweaveTxId) {
            db.get("p2pclaw_papers_v4").get(paperId).put(gunSafe({ arweave_tx: arweaveTxId }));
        }
    } catch (arweaveErr) {
        console.warn(`[CONSENSUS] Arweave archive failed. Error: ${arweaveErr.message}`);
    }

    // Non-blocking IPFS archiving
    let ipfsCid = null;
    try {
        const result = await publishToIpfsWithRetry(
            paper.title, paper.content, paper.author
        );
        ipfsCid = result.cid;
        if (ipfsCid) {
            db.get("p2pclaw_papers_v4").get(paperId).put(gunSafe({ ipfs_cid: ipfsCid }));
            console.log(`[CONSENSUS] IPFS archive OK: ${ipfsCid}`);
        }
    } catch (ipfsErr) {
        console.warn(`[CONSENSUS] IPFS archive failed for "${paper.title}" - paper is still VERIFIED in DB. Error: ${ipfsErr.message}`);
    }

    // Non-blocking Polygon Blockchain Registry
    try {
        if (process.env.PUBLISHED_PAPER_POLYGON_REGISTRY_ENABLED === 'true') {
            const authorId = paper.author_id || paper.author;
            const polygonTxId = await registerPaperOnChain(paper.title, arweaveTxId || "pending", paper.lean_proof || "none", authorId);
            if (polygonTxId) {
                db.get("p2pclaw_papers_v4").get(paperId).put(gunSafe({ polygon_tx: polygonTxId }));
                console.log(`[CONSENSUS] Polygon registry OK: ${polygonTxId}`);
            }
        }
    } catch (polyErr) {
        console.warn(`[CONSENSUS] Polygon registry failed. Error: ${polyErr.message}`);
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
    console.log(`[CONSENSUS] "${paper.title}" is now VERIFIED in La Rueda. IPFS: ${ipfsCid} | Arweave: ${arweaveTxId}`);
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

// Wheel Deduplication Helper
export function normalizeTitle(t) {
    return (t || "")
        .toLowerCase()
        .replace(/\[contribution by[^\]]*\]/gi, "")
        .replace(/\[by [^\]]*\]/gi, "")
        .replace(/\s*-\s*contribution by.*$/i, "")
        .replace(/\s*by dr\.?\s+\w+(\s+\w+)?$/i, "")
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

// B4 fix: Enhanced in-memory cache using Map for fuzzy matching
// Stores normalizedTitle -> paperId for O(1) exact match + O(N) fuzzy on small in-memory set
const MAX_CACHE_SIZE = 8000;

export const titleCache = new Map(); // normalizedTitle -> paperId  (was Set)
export const wordCountCache = new Set();
export const contentHashCache = new Set();

/** Add to a bounded Map/Set - evicts oldest entries when limit is reached. */
function boundedAdd(collection, key, value) {
    if (collection instanceof Map) {
        if (collection.size >= MAX_CACHE_SIZE) {
            const first = collection.keys().next().value;
            collection.delete(first);
        }
        collection.set(key, value || true);
    } else {
        // Set
        if (collection.size >= MAX_CACHE_SIZE) {
            const first = collection.values().next().value;
            collection.delete(first);
        }
        collection.add(key);
    }
}

// Persistent Title Registry (Phase 70: Auto-Deduplication)
const registry = db.get("registry/titles");
const wordCountRegistry = db.get("registry/wordcounts");
const contentHashRegistry = db.get("registry/contenthashes");

// Hydrate title cache ONCE at startup
setTimeout(() => {
    db.get("p2pclaw_papers_v4").map().once((data, id) => {
        if (!data || !data.title) return;
        boundedAdd(titleCache, normalizeTitle(data.title), id);
        if (data.abstract_hash) boundedAdd(abstractHashCache, data.abstract_hash);
    });
    db.get("p2pclaw_mempool_v4").map().once((data, id) => {
        if (!data || data.status !== 'MEMPOOL' || !data.title) return;
        boundedAdd(titleCache, normalizeTitle(data.title), id);
        if (data.abstract_hash) boundedAdd(abstractHashCache, data.abstract_hash);
    });
}, 5000); // 5s after boot

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
    const normalized = (content || "")
        .replace(/\*\*Agent:\*\*.*?\n/g, "")
        .replace(/\*\*Date:\*\*.*?\n/g, "")
        .replace(/\*\*Investigation:\*\*.*?\n/g, "")
        .replace(/\*\*Author:\*\*.*?\n/g, "")
        .replace(/\[Contribution by[^\]]*\]/gi, "")
        .replace(/\[by [^\]]*\]/gi, "")
        .replace(/Dr\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        .replace(/Prof\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        .replace(/^#+\s.*\[.*\].*$/gm, "")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Compute a hash of only the Abstract section of a paper.
 */
export function getAbstractHash(content) {
    const text = content || "";
    const match = text.match(/##\s*Abstract\s*([\s\S]*?)(?=##|\n---|\n\*\*|$)/i);
    const abstract = match ? match[1].trim() : text.slice(0, 800);
    const normalized = abstract
        .replace(/Dr\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        .replace(/Prof\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "AUTHOR")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
    if (normalized.length < 50) return null;
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * B1 fix: Replace setTimeout with gunOnce for deep registry checks
 */
export async function checkRegistryDeep(title) {
    const norm = normalizeTitle(title);
    return await gunOnce(registry.get(norm));
}

export async function checkWordCountDeep(wc) {
    return await gunOnce(wordCountRegistry.get(wc.toString()));
}

export async function checkHashDeep(content) {
    const hash = getContentHash(content);
    return await gunOnce(contentHashRegistry.get(hash));
}

/**
 * B4 fix: checkDuplicates now uses in-memory Map for fuzzy matching.
 * Falls back to Gun.js scan only if cache is cold (< 5 entries).
 */
export async function checkDuplicates(title) {
    // Fast path: Use in-memory cache if populated
    if (titleCache.size >= 5) {
        const matches = [];
        for (const [normTitle, id] of titleCache) {
            const sim = titleSimilarity(title, normTitle);
            if (sim >= 0.50) matches.push({ id, title: normTitle, similarity: sim });
        }
        return matches.sort((a, b) => b.similarity - a.similarity);
    }

    // Cold cache fallback: Use gunCollect instead of setTimeout
    const allPapers = await gunCollect(
        db.get("p2pclaw_papers_v4"),
        (data) => data && data.title,
        { limit: 500 }
    );
    const mempoolPapers = await gunCollect(
        db.get("p2pclaw_mempool_v4"),
        (data) => data && data.title && data.status !== 'DENIED',
        { limit: 500 }
    );

    const combined = [...allPapers, ...mempoolPapers];

    const matches = combined
        .map(p => ({ ...p, similarity: titleSimilarity(title, p.title) }))
        .filter(p => p.similarity >= 0.50)
        .sort((a, b) => b.similarity - a.similarity);

    return matches;
}

/**
 * Check if a paper with the same investigation_id AND similar title already exists.
 * B1 fix: Uses gunCollect instead of setTimeout
 */
export async function checkInvestigationDuplicate(investigationId, title) {
    if (!investigationId) return null;

    const checkCollection = async (gunRef) => {
        const items = await gunCollect(
            gunRef,
            (data) => data && data.investigation_id === investigationId && data.status !== 'DENIED',
            { limit: 200 }
        );
        for (const item of items) {
            const sim = titleSimilarity(item.title || "", title);
            if (sim >= 0.55) {
                return { paperId: item.id, title: item.title, similarity: sim, status: item.status || 'MEMPOOL' };
            }
        }
        return null;
    };

    const mempoolMatch = await checkCollection(db.get("p2pclaw_mempool_v4"));
    if (mempoolMatch) return mempoolMatch;

    // Also check verified papers
    const items = await gunCollect(
        db.get("p2pclaw_papers_v4"),
        (data) => data && data.investigation_id === investigationId,
        { limit: 200 }
    );
    for (const item of items) {
        const sim = titleSimilarity(item.title || "", title);
        if (sim >= 0.55) {
            return { paperId: item.id, title: item.title, similarity: sim, status: 'VERIFIED' };
        }
    }

    return null;
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
    return await gunOnce(db.get("registry/abstracthashes").get(hash));
}
