/**
 * P2PCLAW Federated Learning â€” FedAvg with Differential Privacy
 * =============================================================
 * Implements Â§4.4 of P2PCLAW_Guia_Implementacion_Completa.md
 * Based on: McMahan et al. 2017 (FedAvg) + Abadi et al. 2016 (DP-SGD)
 *
 * Architecture:
 *   - Each agent contributes local model gradient updates
 *   - Server aggregates via FedAvg once â‰¥ MIN_AGENTS contribute per round
 *   - Differential privacy: Gaussian noise + gradient clipping
 *   - Gradients stored in Gun.js for fully decentralized coordination
 *
 * Usage:
 *   const fl = new FederatedLearning(db);
 *   await fl.publishUpdate(agentId, gradient, round);
 *   const global = await fl.aggregateRound(round);
 */

import crypto from "node:crypto";

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MIN_AGENTS_FOR_AGGREGATION = 3;   // FedAvg: min participants per round
const MAX_GRADIENT_NORM = 1.0;          // DP-SGD: gradient clipping threshold (C)
const DP_NOISE_SIGMA = 0.1;             // DP-SGD: Gaussian noise std deviation
const ROUND_TIMEOUT_MS = 30 * 60 * 1000; // 30 min max wait per FL round
const MAX_GRADIENT_DIM = 512;           // Max gradient vector size

// â”€â”€ Differential Privacy helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Clip gradient to L2 norm â‰¤ maxNorm (Abadi 2016 Â§Algorithm 1 step 5)
 */
function clipGradient(gradient, maxNorm = MAX_GRADIENT_NORM) {
    const norm = l2Norm(gradient);
    if (norm <= maxNorm) return [...gradient];
    const scale = maxNorm / (norm + 1e-9);
    return gradient.map(v => v * scale);
}

/**
 * Add Gaussian noise N(0, sigmaÂ²) for differential privacy
 * Noise calibrated to sensitivity: Ïƒ = sigma * C / N
 */
function addGaussianNoise(gradient, sigma = DP_NOISE_SIGMA, n = 1) {
    return gradient.map(v => v + gaussianRandom() * sigma * MAX_GRADIENT_NORM / n);
}

/**
 * Box-Muller transform for Gaussian random numbers
 */
function gaussianRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
}

function l2Norm(v) {
    return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/**
 * FedAvg aggregation: weighted average of gradients
 * w_i = n_i / sum(n_i) where n_i = samples contributed by agent i
 */
function fedAvg(updates) {
    if (!updates.length) return null;
    const dim = updates[0].gradient.length;
    const totalSamples = updates.reduce((s, u) => s + (u.samples || 1), 0);
    const aggregated = new Array(dim).fill(0);
    for (const update of updates) {
        const weight = (update.samples || 1) / totalSamples;
        for (let i = 0; i < dim; i++) {
            aggregated[i] += (update.gradient[i] || 0) * weight;
        }
    }
    return aggregated;
}

// â”€â”€ FederatedLearning class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export class FederatedLearning {
    constructor(db) {
        this.db = db;
        this.node = db.get("federated-learning");
        // In-memory cache of updates per round: Map<round, Map<agentId, update>>
        this.roundUpdates = new Map();
        // Listeners registered per round to avoid duplicate processing
        this._listenerRounds = new Set();
    }

    /**
     * Publish a local gradient update to Gun.js for the given FL round.
     * Applies DP-SGD: gradient clipping + Gaussian noise before storage.
     *
     * @param {string} agentId - publishing agent
     * @param {number[]} localGradient - local model gradient vector
     * @param {number} round - FL round number
     * @param {number} [samples=1] - local dataset size (for weighted FedAvg)
     * @returns {Promise<{updateId, round, dim, norm}>}
     */
    async publishUpdate(agentId, localGradient, round, samples = 1) {
        if (!Array.isArray(localGradient) || localGradient.length === 0) {
            throw new Error("localGradient must be a non-empty array");
        }
        if (localGradient.length > MAX_GRADIENT_DIM) {
            throw new Error(`Gradient dimension ${localGradient.length} exceeds max ${MAX_GRADIENT_DIM}`);
        }

        // DP-SGD: clip then perturb
        const clipped  = clipGradient(localGradient);
        const noisy    = addGaussianNoise(clipped, DP_NOISE_SIGMA, samples);
        const updateId = crypto.randomUUID();

        const update = {
            updateId,
            agentId,
            round,
            samples,
            gradient: JSON.stringify(noisy),  // Gun.js stores strings
            norm_before_clip: l2Norm(localGradient),
            norm_after_clip: l2Norm(clipped),
            timestamp: Date.now()
        };

        // Store in Gun.js: fl.rounds.<round>.<agentId>
        await new Promise(resolve => {
            this.node.get("rounds").get(String(round)).get(agentId).put(update, () => resolve());
        });

        // Cache locally
        if (!this.roundUpdates.has(round)) this.roundUpdates.set(round, new Map());
        this.roundUpdates.get(round).set(agentId, { ...update, gradient: noisy });

        console.log(`[FL] Agent ${agentId} published gradient for round ${round} (dim=${noisy.length}, norm=${l2Norm(noisy).toFixed(4)})`);

        return {
            updateId,
            round,
            dim: noisy.length,
            norm: l2Norm(noisy).toFixed(4),
            dp_applied: true
        };
    }

    /**
     * Aggregate all updates for a round using FedAvg.
     * Waits until MIN_AGENTS have contributed (up to ROUND_TIMEOUT_MS).
     *
     * @param {number} round
     * @param {number} [minAgents]
     * @returns {Promise<{round, gradient, contributors, aggregated_at}>}
     */
    async aggregateRound(round, minAgents = MIN_AGENTS_FOR_AGGREGATION) {
        // Check if already aggregated
        const cached = await this._getCachedAggregation(round);
        if (cached) return cached;

        // Load updates from Gun.js
        const updates = await this._loadRoundUpdates(round);

        if (updates.length < minAgents) {
            return {
                round,
                status: "waiting",
                contributors: updates.length,
                required: minAgents,
                message: `Need ${minAgents - updates.length} more agent(s) to contribute`
            };
        }

        // FedAvg aggregation
        const aggregatedGradient = fedAvg(updates);
        const result = {
            round,
            status: "aggregated",
            gradient: aggregatedGradient,
            contributors: updates.map(u => u.agentId),
            contributor_count: updates.length,
            aggregated_at: Date.now(),
            norm: l2Norm(aggregatedGradient).toFixed(4)
        };

        // Cache result in Gun.js
        this.node.get("aggregations").get(String(round)).put({
            round,
            status: "aggregated",
            gradient: JSON.stringify(aggregatedGradient),
            contributor_count: updates.length,
            contributors: JSON.stringify(result.contributors),
            aggregated_at: result.aggregated_at,
            norm: result.norm
        });

        console.log(`[FL] Round ${round} aggregated: ${updates.length} agents, gradient norm=${result.norm}`);
        return result;
    }

    /**
     * Get current status of an FL round.
     */
    async getRoundStatus(round) {
        const updates = await this._loadRoundUpdates(round);
        const cached  = await this._getCachedAggregation(round);

        return {
            round,
            contributors: updates.map(u => u.agentId),
            contributor_count: updates.length,
            required: MIN_AGENTS_FOR_AGGREGATION,
            ready_to_aggregate: updates.length >= MIN_AGENTS_FOR_AGGREGATION,
            aggregated: !!cached,
            aggregation: cached || null,
            config: {
                min_agents: MIN_AGENTS_FOR_AGGREGATION,
                max_gradient_norm: MAX_GRADIENT_NORM,
                dp_noise_sigma: DP_NOISE_SIGMA,
                algorithm: "FedAvg + DP-SGD (Abadi 2016)"
            }
        };
    }

    /**
     * Get current FL round number (latest round with any contribution).
     */
    async getCurrentRound() {
        return new Promise(resolve => {
            let maxRound = 0;
            this.node.get("rounds").map().once((data, key) => {
                const r = parseInt(key, 10);
                if (!isNaN(r) && r > maxRound) maxRound = r;
            });
            setTimeout(() => resolve(maxRound || 1), 1500);
        });
    }

    // â”€â”€ Private helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async _loadRoundUpdates(round) {
        // Use local cache first
        const cached = this.roundUpdates.get(round);
        if (cached && cached.size > 0) {
            return Array.from(cached.values());
        }

        return new Promise(resolve => {
            const updates = [];
            this.node.get("rounds").get(String(round)).map().once((data, agentId) => {
                if (!data || !data.gradient) return;
                try {
                    const gradient = JSON.parse(data.gradient);
                    updates.push({
                        agentId: data.agentId || agentId,
                        gradient,
                        samples: data.samples || 1,
                        timestamp: data.timestamp || 0
                    });
                } catch { /* skip malformed */ }
            });
            setTimeout(() => {
                // Populate local cache
                if (!this.roundUpdates.has(round)) this.roundUpdates.set(round, new Map());
                for (const u of updates) this.roundUpdates.get(round).set(u.agentId, u);
                resolve(updates);
            }, 2000);
        });
    }

    async _getCachedAggregation(round) {
        return new Promise(resolve => {
            this.node.get("aggregations").get(String(round)).once(data => {
                if (!data || data.status !== "aggregated") return resolve(null);
                try {
                    resolve({
                        round,
                        status: "aggregated",
                        gradient: JSON.parse(data.gradient),
                        contributors: JSON.parse(data.contributors || "[]"),
                        contributor_count: data.contributor_count,
                        aggregated_at: data.aggregated_at,
                        norm: data.norm
                    });
                } catch { resolve(null); }
            });
        });
    }
}

// â”€â”€ Singleton export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _instance = null;
export function getFederatedLearning(db) {
    if (!_instance && db) _instance = new FederatedLearning(db);
    return _instance;
}
