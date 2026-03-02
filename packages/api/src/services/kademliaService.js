/**
 * P2PCLAW Kademlia DHT Service
 * ==============================
 * Simplified Kademlia-style distributed routing table.
 * XOR-metric peer discovery over the existing Gun.js P2P mesh.
 *
 * Key concepts (Â§4.1, Â§5.1 of the P2PCLAW guide):
 *   - Each node has a 256-bit XOR-addressable ID (SHA256 of agentId)
 *   - Routing table: 256 k-buckets (k=20) ordered by XOR distance
 *   - FIND_NODE: returns k closest peers to a target key
 *   - Provides eclipse-attack resistance vs single-relay Gun.js
 *
 * This implementation provides:
 *   - GET /dht-peers?target=agentId     â†’ k closest peers
 *   - POST /dht-announce                â†’ add yourself to routing table
 *   - GET /dht-stats                    â†’ routing table stats
 */

import crypto from 'crypto';
import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";

const K = 20;            // k-bucket size
const ALPHA = 3;         // parallel lookups
const ID_BYTES = 32;     // 256-bit IDs (SHA256)
const STALE_MS = 30 * 60 * 1000; // 30 min â€” stale peers get evicted

/** Compute the 256-bit Kademlia node ID for any string. */
export function kademliaId(str) {
    return crypto.createHash('sha256').update(String(str)).digest('hex');
}

/**
 * XOR distance between two hex-encoded 256-bit IDs.
 * Returns a hex string (lower = closer).
 */
export function xorDistance(a, b) {
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    const result = Buffer.allocUnsafe(ID_BYTES);
    for (let i = 0; i < ID_BYTES; i++) result[i] = aBuf[i] ^ bBuf[i];
    return result.toString('hex');
}

/**
 * Leading-zero count of a hex string â†’ bucket index (0 = farthest, 255 = closest).
 */
function bucketIndex(hexDist) {
    const buf = Buffer.from(hexDist, 'hex');
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] !== 0) {
            let b = buf[i];
            let zeros = 0;
            for (let bit = 7; bit >= 0; bit--) {
                if ((b >> bit) & 1) break;
                zeros++;
            }
            return i * 8 + zeros;
        }
    }
    return ID_BYTES * 8 - 1; // identical ID
}

class KademliaRoutingTable {
    constructor(localId) {
        this.localId = localId;
        // 256 buckets, each holds up to K peers
        this.buckets = Array.from({ length: 256 }, () => []);
        this.totalPeers = 0;
    }

    /** Add or refresh a peer in the routing table. */
    addPeer(peer) {
        const peerId = kademliaId(peer.id);
        if (peerId === this.localId) return; // don't add self

        const dist  = xorDistance(this.localId, peerId);
        const bIdx  = bucketIndex(dist);
        const bucket = this.buckets[bIdx];

        const existingIdx = bucket.findIndex(p => p.id === peer.id);
        const entry = {
            id:         peer.id,
            name:       peer.name    || peer.id,
            address:    peer.address || null,
            kademliaId: peerId,
            lastSeen:   Date.now(),
            contributions: peer.contributions || 0,
            rank:       peer.rank || 'NEWCOMER',
        };

        if (existingIdx !== -1) {
            // Move to tail (most-recently-seen)
            bucket.splice(existingIdx, 1);
            bucket.push(entry);
        } else if (bucket.length < K) {
            bucket.push(entry);
            this.totalPeers++;
        } else {
            // Bucket full â€” evict stale peer at head if any
            const staleIdx = bucket.findIndex(p => Date.now() - p.lastSeen > STALE_MS);
            if (staleIdx !== -1) {
                bucket.splice(staleIdx, 1);
                bucket.push(entry);
            }
            // Otherwise discard (the closest bucket is full of active peers)
        }
    }

    /** Find the k closest peers to a target ID (hex). */
    findClosest(targetId, count = K) {
        const all = this.buckets.flat();
        return all
            .map(p => ({
                ...p,
                _dist: xorDistance(p.kademliaId, targetId),
            }))
            .sort((a, b) => a._dist < b._dist ? -1 : a._dist > b._dist ? 1 : 0)
            .slice(0, count)
            .map(({ _dist, kademliaId: _, ...p }) => p); // strip internal fields
    }

    /** Evict peers that haven't been seen in STALE_MS. */
    evictStale() {
        let evicted = 0;
        for (const bucket of this.buckets) {
            const before = bucket.length;
            const filtered = bucket.filter(p => Date.now() - p.lastSeen <= STALE_MS);
            evicted += before - filtered.length;
            bucket.length = 0;
            bucket.push(...filtered);
        }
        this.totalPeers = this.buckets.reduce((s, b) => s + b.length, 0);
        return evicted;
    }

    stats() {
        const nonEmpty = this.buckets.filter(b => b.length > 0).length;
        return {
            localId:      this.localId,
            totalPeers:   this.buckets.reduce((s, b) => s + b.length, 0),
            bucketsUsed:  nonEmpty,
            totalBuckets: 256,
            K,
        };
    }
}

// â”€â”€ Singleton routing table for this API node â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LOCAL_NODE_ID = kademliaId('p2pclaw-api-node');
const routingTable  = new KademliaRoutingTable(LOCAL_NODE_ID);

// Evict stale peers every 10 minutes
setInterval(() => {
    const n = routingTable.evictStale();
    if (n > 0) console.log(`[DHT] Evicted ${n} stale peers.`);
}, 10 * 60 * 1000);

/**
 * Announce an agent to the DHT routing table.
 * Call this whenever an agent registers (quick-join, presence, etc.).
 */
export function dhtAnnounce(agent) {
    routingTable.addPeer(agent);
}

/**
 * Find closest peers to a target agent/key ID.
 * @param {string} targetId - Any string (agentId, paperId, topicId, etc.)
 * @param {number} [count=K] - How many peers to return.
 */
export function dhtFindPeers(targetId, count = K) {
    const targetKId = kademliaId(targetId);
    return routingTable.findClosest(targetKId, count);
}

export function dhtStats() {
    return routingTable.stats();
}

export { LOCAL_NODE_ID, routingTable };

/**
 * Bootstrap: load all online agents from Gun.js into the routing table on startup.
 */
export function bootstrapDHT() {
    const cutoff = Date.now() - 60 * 60 * 1000; // last hour
    db.get("agents").map().once((data, id) => {
        if (data && data.lastSeen && data.lastSeen > cutoff) {
            routingTable.addPeer({ id, ...data });
        }
    });
    console.log('[DHT] Bootstrap complete â€” routing table seeded from Gun.js agents.');
}
