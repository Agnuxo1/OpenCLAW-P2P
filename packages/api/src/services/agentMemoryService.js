/**
 * P2PCLAW Agent Memory Service
 * ==============================
 * Persistent cross-session memory for autonomous agents.
 * Implements the AgentMemory class from Â§3.5/Â§4.4 of the guide.
 *
 * Storage:  Gun.js path "memories/{agentId}/{key}"
 * Search:   SparseEmbeddingStore (TF-IDF bigram hashing, no external model)
 * Pattern:  remember/recall/search â€” persists across server restarts
 */

import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";
import { SparseEmbeddingStore } from "./sparse-memory.js";

const MAX_MEMORY_KEYS = 200; // per agent, to prevent unbounded growth

export class AgentMemory {
    /**
     * @param {string} agentId - The agent's unique ID.
     */
    constructor(agentId) {
        this.agentId    = agentId;
        this.store      = new SparseEmbeddingStore();
        this.node       = db.get("memories").get(agentId);
        this._localMap  = new Map(); // write-through cache â€” instant reads, no Gun.js round-trip needed
    }

    /**
     * Store a key-value in the agent's persistent memory.
     * Optionally provide `text` for semantic search indexing.
     *
     * @param {string} key    - Memory key (e.g. 'current_investigation', 'last_paper').
     * @param {*}      value  - Any JSON-serialisable value.
     * @param {string} [text] - Optional text for semantic embedding (for search).
     */
    async remember(key, value, text = null) {
        const serialized = JSON.stringify(value);
        const entry = gunSafe({
            key,
            value:         serialized,
            timestamp:     Date.now(),
            has_embedding: !!text,
        });
        // Write-through: update local Map immediately so recall is instant
        this._localMap.set(key, value);
        this.node.get(key).put(entry);
        if (text) {
            this.store.storeText(key, text);
        }
        return this;
    }

    /**
     * Recall a single memory by key.
     * Checks the in-process write-through cache first, then Gun.js.
     * @returns {Promise<*|null>} Parsed value or null if not found.
     */
    async recall(key) {
        // Fast path: in-process write-through cache
        if (this._localMap.has(key)) return this._localMap.get(key);
        // Slow path: Gun.js (persisted across restarts)
        return new Promise(resolve => {
            this.node.get(key).once(data => {
                if (!data || !data.value) return resolve(null);
                try {
                    const parsed = JSON.parse(data.value);
                    this._localMap.set(key, parsed); // populate cache from Gun
                    resolve(parsed);
                } catch {
                    resolve(data.value); // raw string fallback
                }
            });
        });
    }

    /**
     * Load all memories from Gun.js on agent reconnect.
     * Merges Gun.js data into the in-process write-through cache.
     * Returns a flat object: { key: value, ... }
     */
    async recallAll() {
        // Start with whatever is in the write-through cache
        const memories = Object.fromEntries(this._localMap);
        // Merge in Gun.js data (catches entries from previous server instances)
        await new Promise(resolve => {
            this.node.map().once((data, key) => {
                if (!data || !data.value || data.deleted) return;
                try {
                    const parsed = JSON.parse(data.value);
                    memories[key] = parsed;
                    this._localMap.set(key, parsed); // backfill cache
                } catch {
                    memories[key] = data.value;
                    this._localMap.set(key, data.value);
                }
            });
            setTimeout(resolve, 1500);
        });
        return memories;
    }

    /**
     * Semantic search across memories that were stored with `text`.
     * Returns top-K keys ranked by cosine similarity.
     */
    searchSimilar(queryText, topK = 5) {
        return this.store.searchSimilarText(queryText, topK);
    }

    /**
     * Forget (delete) a specific memory key.
     */
    forget(key) {
        // Gun.js doesn't support true delete â€” we mark as deleted
        this.node.get(key).put(gunSafe({ key, value: null, timestamp: Date.now(), deleted: true }));
        this._localMap.delete(key);
        this.store.embeddings.delete(key);
    }

    /** Memory stats. */
    stats() {
        return {
            agentId:      this.agentId,
            storeSize:    this.store.size,
            storeMemory:  this.store.memoryStats(),
        };
    }
}

// â”€â”€ In-process cache: one AgentMemory instance per agentId â”€â”€â”€â”€â”€â”€â”€â”€
const _memoryCache = new Map(); // agentId â†’ AgentMemory

export function getAgentMemory(agentId) {
    if (!_memoryCache.has(agentId)) {
        _memoryCache.set(agentId, new AgentMemory(agentId));
    }
    return _memoryCache.get(agentId);
}

/**
 * Save a key-value to an agent's persistent memory.
 */
export async function saveMemory(agentId, key, value, text = null) {
    const mem = getAgentMemory(agentId);
    await mem.remember(key, value, text);
    return { agentId, key, saved: true };
}

/**
 * Load all memories for an agent.
 */
export async function loadMemory(agentId) {
    const mem = getAgentMemory(agentId);
    const memories = await mem.recallAll();
    return { agentId, memories, count: Object.keys(memories).length };
}
