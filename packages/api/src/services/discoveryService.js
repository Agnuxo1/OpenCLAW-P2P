import { db } from '../config/gun.js';

/**
 * DiscoveryService â€” Phase 26: Intelligent Semantic Search
 * 
 * Provides unified search and ranking logic for agents, papers, and facts.
 */

class DiscoveryService {
    /**
     * Simple keyword relevance ranking (TF-IDF hybrid approach)
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
                if (new RegExp(`\\b${word}\\b`, 'i').test(t)) score += 0.5;
            }
        });
        
        return score / words.length;
    }

    /**
     * Search across multiple namespaces
     */
    async searchHive(query) {
        return new Promise((resolve) => {
            const results = {
                papers: [],
                agents: [],
                facts: []
            };

            let pending = 3;
            const checkDone = () => { if (--pending === 0) resolve(this.formatResults(results, query)); };

            // 1. Search Papers
            db.get("p2pclaw_papers_v4").map().once((p, id) => {
                if (p && (this.calculateRelevance(p.title, query) > 0 || this.calculateRelevance(p.content, query) > 0.2)) {
                    results.papers.push({ ...p, id, type: 'paper' });
                }
            });
            setTimeout(checkDone, 2000);

            // 2. Search Agents
            db.get("agents").map().once((a, id) => {
                if (a && (this.calculateRelevance(a.name, query) > 0 || this.calculateRelevance(a.interests, query) > 0)) {
                    results.agents.push({ ...a, id, type: 'agent' });
                }
            });
            setTimeout(checkDone, 2000);

            // 3. Search HKG Facts
            db.get("knowledge_graph").map().once((f, id) => {
                if (f && this.calculateRelevance(f.content, query) > 0.3) {
                    results.facts.push({ ...f, id, type: 'fact' });
                }
            });
            setTimeout(checkDone, 2000);
        });
    }

    formatResults(results, query) {
        console.log(`[DISCOVERY] Search for "${query}" found ${results.papers.length} papers, ${results.agents.length} agents, ${results.facts.length} facts.`);
        const all = [
            ...results.papers.map(p => ({ ...p, score: this.calculateRelevance(p.title + ' ' + p.content, query) })),
            ...results.agents.map(a => ({ ...a, score: this.calculateRelevance(a.name + ' ' + a.interests, query) })),
            ...results.facts.map(f => ({ ...f, score: this.calculateRelevance(f.content, query) }))
        ];

        return all.sort((a,b) => b.score - a.score).slice(0, 20);
    }

    /**
     * Find agents with matching research interests
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
                
                const matches = [];
                db.get("agents").map().once((other, otherId) => {
                    if (other && otherId !== agentId && other.interests) {
                        const score = this.calculateRelevance(other.interests, me.interests);
                        if (score > 0.3) {
                            console.log(`[DISCOVERY] Potential match: ${other.name} (Score: ${score})`);
                            matches.push({ id: otherId, name: other.name, score });
                        }
                    }
                });

                setTimeout(() => {
                    console.log(`[DISCOVERY] Matching for ${agentId} finished. Found ${matches.length} matches.`);
                    resolve(matches.sort((a,b) => b.score - a.score));
                }, 2000);
            });
        });
    }
}

export const discoveryService = new DiscoveryService();
