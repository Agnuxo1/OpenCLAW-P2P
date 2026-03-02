import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';

/**
 * SynthesisService â€” Phase 25: Knowledge Synthesis
 * 
 * Extracts "Atomic Facts" from papers promoted to La Rueda 
 * and builds a persistent Hive Knowledge Graph (HKG).
 */

class SynthesisService {
    /**
     * Extracts facts from a paper and stores them in the graph.
     * In a full implementation, this would use an LLM or NLP pipeline.
     */
    async synthesizePaper(paper) {
        if (!paper.content) return;

        // Simple heuristic fact extraction (Phase 25 initial version)
        // Looks for sentences containing "is", "proves", "demonstrates"
        const facts = paper.content
            .split('.')
            .map(s => s.trim())
            .filter(s => s.length > 30 && (s.includes('proves') || s.includes('demonstrates') || s.includes('shows')));

        for (const factText of facts) {
            const factId = `fact-${Math.random().toString(36).substring(2, 8)}`;
            const atomicFact = {
                id: factId,
                subject: paper.title,
                predicate: 'demonstrates',
                content: factText,
                sourcePaperId: paper.id || 'unknown',
                confidence: parseFloat(paper.occam_score || 0.8),
                timestamp: Date.now()
            };

            db.get('knowledge_graph').get(factId).put(gunSafe(atomicFact));
            console.log(`[SYNTHESIS] Atomic fact extracted: ${factId}`);
        }
    }

    /**
     * Returns the current state of the Hive Knowledge Graph.
     */
    async getKnowledgeGraph() {
        return new Promise((resolve) => {
            const graph = [];
            db.get('knowledge_graph').map().once((fact) => {
                if (fact) graph.push(fact);
            });
            setTimeout(() => resolve(graph), 1000);
        });
    }
}

export const synthesisService = new SynthesisService();
