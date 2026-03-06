import { db } from '../config/gun.js';
import { gunCollect } from '../utils/gunCollect.js';

/**
 * DiscoveryService - Phase 26: Intelligent Semantic Search
 * 
 * Provides unified search and ranking logic for agents, papers, and facts.
 */

class DiscoveryService {
    constructor() {
        // B3 fix: Cache compiled regexes for word boundary checks
        this._regexCache = new Map();
    }

    /**
     * Get or create a cached regex for a word
     */
    _getWordRegex(word) {
        if (!this._regexCache.has(word)) {
            this._regexCache.set(word, new RegExp(`\\b${word}\\b`, 'i'));
        }
        return this._regexCache.get(word);
    }

    /**
     * Simple keyword relevance ranking (TF-IDF hybrid approach)
     * B3 fix: Uses cached regexes instead of creating new RegExp per word per call
     */
    calculateRelevance(text, query) {
        if (!text || !query) return 0;
        const q = query.toLowerCase().trim();
        const t = text.toLowerCase();

        let score = 0;
        const words = q.split(/\s+/);

        words.forEach(word => {
            if (t.includes(word)) {
                score += 1;
                // Bonus for exact word match vs substring
                if (this._getWordRegex(word).test(t)) score += 0.5;
            }
        });

        return score / words.length;
    }

    /**
     * Search across multiple namespaces
     * B1 fix: Uses gunCollect instead of fixed setTimeout
     */
    async searchHive(query) {
        // B1 fix: Run all three collections in parallel with smart idle resolution
        const [papers, agents, facts] = await Promise.all([
            gunCollect(
                db.get("p2pclaw_papers_v4"),
                (p) => p && (this.calculateRelevance(p.title, query) > 0 || this.calculateRelevance(p.content, query) > 0.2),
                { limit: 200 }
            ),
            gunCollect(
                db.get("agents"),
                (a) => a && (this.calculateRelevance(a.name, query) > 0 || this.calculateRelevance(a.interests, query) > 0),
                { limit: 200 }
            ),
            gunCollect(
                db.get("knowledge_graph"),
                (f) => f && this.calculateRelevance(f.content, query) > 0.3,
                { limit: 200 }
            )
        ]);

        const results = {
            papers: papers.map(p => ({ ...p, type: 'paper' })),
            agents: agents.map(a => ({ ...a, type: 'agent' })),
            facts: facts.map(f => ({ ...f, type: 'fact' }))
        };

        return this.formatResults(results, query);
    }

    formatResults(results, query) {
        console.log(`[DISCOVERY] Search for "${query}" found ${results.papers.length} papers, ${results.agents.length} agents, ${results.facts.length} facts.`);
        const all = [
            ...results.papers.map(p => ({ ...p, score: this.calculateRelevance(p.title + ' ' + p.content, query) })),
            ...results.agents.map(a => ({ ...a, score: this.calculateRelevance(a.name + ' ' + a.interests, query) })),
            ...results.facts.map(f => ({ ...f, score: this.calculateRelevance(f.content, query) }))
        ];

        return all.sort((a, b) => b.score - a.score).slice(0, 20);
    }

    /**
     * Find agents with matching research interests
     * B1 fix: Uses gunCollect + gunOnce instead of nested setTimeout
     */
    async findMatchingAgents(agentId) {
        return new Promise((resolve) => {
            db.get("agents").get(agentId).once(async (me) => {
                if (!me) {
                    console.log(`[DISCOVERY] Agent ${agentId} not found for matching.`);
                    return resolve([]);
                }
                if (!me.interests) {
                    console.log(`[DISCOVERY] Agent ${agentId} has no interests defined.`);
                    return resolve([]);
                }

                // B1 fix: Use gunCollect instead of setTimeout
                const others = await gunCollect(
                    db.get("agents"),
                    (other, otherId) => other && otherId !== agentId && other.interests,
                    { limit: 200 }
                );

                const matches = others
                    .map(other => ({
                        id: other.id,
                        name: other.name,
                        score: this.calculateRelevance(other.interests, me.interests)
                    }))
                    .filter(m => m.score > 0.3)
                    .sort((a, b) => b.score - a.score);

                console.log(`[DISCOVERY] Matching for ${agentId} finished. Found ${matches.length} matches.`);
                resolve(matches);
            });
        });
    }
}

export const discoveryService = new DiscoveryService();
