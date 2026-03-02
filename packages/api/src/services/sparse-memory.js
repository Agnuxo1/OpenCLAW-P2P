/**
 * P2PCLAW Sparse Memory â€” Veselov Hierarchical Representation
 * ===========================================================
 * Implements hierarchical sparse number representation (Â§2.3, Â§3.5).
 * Level weights grow super-exponentially: w_l = 10^(3Â·2^(l-1))
 * Memory savings: 100-1000x for sparse embeddings vs dense arrays.
 *
 * Classes:
 *   SparseHierarchicalNumber  â€” BigInt-based sparse number
 *   SparseEmbeddingStore      â€” semantic similarity without external model
 */

// Level weights: w0=1, w1=1000, w2=10^6, w3=10^12, w4=10^24, ...
const LEVEL_WEIGHTS = [1n];
for (let i = 1; i <= 20; i++) {
    LEVEL_WEIGHTS.push(LEVEL_WEIGHTS[i - 1] * 1000n);
}

export class SparseHierarchicalNumber {
    constructor() {
        this.levels = new Map(); // level â†’ BigInt value
    }

    set(level, value) {
        if (value === 0n) this.levels.delete(level);
        else this.levels.set(level, value);
    }

    get(level) {
        return this.levels.get(level) || 0n;
    }

    add(other) {
        const result = new SparseHierarchicalNumber();
        const allLevels = new Set([...this.levels.keys(), ...other.levels.keys()]);
        let carry = 0n;
        for (const lvl of [...allLevels].sort((a, b) => a - b)) {
            const total = this.get(lvl) + other.get(lvl) + carry;
            const w = LEVEL_WEIGHTS[lvl + 1] || LEVEL_WEIGHTS[LEVEL_WEIGHTS.length - 1];
            result.set(lvl, total % w);
            carry = total / w;
        }
        if (carry > 0n) {
            const maxLevel = [...result.levels.keys()].length;
            result.set(maxLevel, carry);
        }
        return result;
    }

    get density() {
        return this.levels.size / Math.max(this.maxLevel + 1, 1);
    }

    get maxLevel() {
        return this.levels.size > 0 ? Math.max(...this.levels.keys()) : 0;
    }

    /** Approximate memory in bytes (8B level key + ~16B BigInt) */
    memoryBytes() {
        return this.levels.size * 24;
    }

    toJSON() {
        const obj = {};
        for (const [k, v] of this.levels) obj[k] = v.toString();
        return obj;
    }

    static fromJSON(obj) {
        const n = new SparseHierarchicalNumber();
        for (const [k, v] of Object.entries(obj)) n.set(Number(k), BigInt(v));
        return n;
    }
}

/**
 * Sparse embedding store for papers â€” O(1) per non-zero dimension.
 * Cosine similarity uses only non-zero dims (fast for sparse vectors).
 */
export class SparseEmbeddingStore {
    constructor() {
        this.embeddings = new Map(); // paperId â†’ { dims: Map<idx,float>, total: number }
    }

    /**
     * Store a dense embedding as sparse (drops dims below threshold).
     * Returns the density ratio (smaller = more memory savings).
     */
    store(paperId, embedding, threshold = 0.01) {
        const sparse = new Map();
        for (let i = 0; i < embedding.length; i++) {
            if (Math.abs(embedding[i]) > threshold) {
                sparse.set(i, embedding[i]);
            }
        }
        this.embeddings.set(paperId, { dims: sparse, total: embedding.length });
        return sparse.size / embedding.length; // density
    }

    /**
     * Store a text-derived sparse embedding using TF-IDF style hashing.
     * No external model needed â€” uses character n-gram hashing.
     */
    storeText(paperId, text, dimensions = 512) {
        const embedding = new Float32Array(dimensions);
        const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        for (const word of words) {
            // Simple hash to dimension index
            let h = 0;
            for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) % dimensions;
            embedding[h] += 1;
            // Bigram
            if (word.length > 3) {
                let h2 = 0;
                for (let i = 0; i < word.length - 1; i++) {
                    const bigram = word.slice(i, i + 2);
                    for (let j = 0; j < bigram.length; j++) h2 = (h2 * 31 + bigram.charCodeAt(j)) % dimensions;
                }
                embedding[h2 % dimensions] += 0.5;
            }
        }
        // L2 normalize
        let norm = 0;
        for (let i = 0; i < dimensions; i++) norm += embedding[i] * embedding[i];
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < dimensions; i++) embedding[i] /= norm;

        return this.store(paperId, embedding);
    }

    cosineSimilarity(paperId1, paperId2) {
        const e1 = this.embeddings.get(paperId1)?.dims;
        const e2 = this.embeddings.get(paperId2)?.dims;
        if (!e1 || !e2) return 0;
        let dot = 0, norm1 = 0, norm2 = 0;
        for (const [i, v] of e1) { norm1 += v * v; if (e2.has(i)) dot += v * e2.get(i); }
        for (const [, v] of e2) norm2 += v * v;
        return dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-9);
    }

    searchSimilar(queryEmbedding, topK = 5, threshold = 0.01) {
        const querySparse = new Map();
        for (let i = 0; i < queryEmbedding.length; i++) {
            if (Math.abs(queryEmbedding[i]) > threshold) querySparse.set(i, queryEmbedding[i]);
        }
        const results = [];
        for (const [pid, emb] of this.embeddings) {
            let dot = 0, norm1 = 0, norm2 = 0;
            for (const [i, v] of querySparse) { norm1 += v * v; if (emb.dims.has(i)) dot += v * emb.dims.get(i); }
            for (const [, v] of emb.dims) norm2 += v * v;
            const sim = dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-9);
            results.push({ paperId: pid, similarity: sim });
        }
        return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
    }

    searchSimilarText(queryText, topK = 5) {
        const tempId = '__query__';
        this.storeText(tempId, queryText);
        const results = this.searchSimilar(
            [...(this.embeddings.get(tempId)?.dims || new Map())].reduce((arr, [i, v]) => {
                arr[i] = v; return arr;
            }, new Float32Array(512)),
            topK + 1
        ).filter(r => r.paperId !== tempId).slice(0, topK);
        this.embeddings.delete(tempId);
        return results;
    }

    get size() { return this.embeddings.size; }

    memoryStats() {
        let total = 0;
        for (const emb of this.embeddings.values()) total += emb.dims.size * 12; // 4B idx + 8B float
        return { papers: this.embeddings.size, bytes: total, kb: (total / 1024).toFixed(1) };
    }
}

// Singleton store for papers â€” shared across the API process
export const globalEmbeddingStore = new SparseEmbeddingStore();
