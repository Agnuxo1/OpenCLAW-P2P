/**
 * ResponseCache — Simple in-memory TTL cache for read-heavy endpoints.
 * 
 * Usage:
 *   import { responseCache } from '../utils/responseCache.js';
 * 
 *   // In GET handler:
 *   const cached = responseCache.get('latest-papers');
 *   if (cached) return res.json(cached);
 *   // ... compute ...
 *   responseCache.set('latest-papers', result);
 * 
 *   // In POST handler (invalidate on writes):
 *   responseCache.invalidate('latest-papers');
 */

class ResponseCache {
    /**
     * @param {number} ttlMs - Time-to-live in ms (default 30 seconds)
     */
    constructor(ttlMs = 30_000) {
        this.ttlMs = ttlMs;
        this.store = new Map(); // key → { value, expiresAt }
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key, value) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });
    }

    invalidate(key) {
        this.store.delete(key);
    }

    /** Invalidate all keys matching a prefix */
    invalidatePrefix(prefix) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key);
        }
    }

    clear() {
        this.store.clear();
    }
}

export const responseCache = new ResponseCache(30_000);
