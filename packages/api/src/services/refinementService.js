import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';

/**
 * RefinementService â€” Phase 25: Scientific Refinement
 * 
 * Manages the autonomous "improvement" loop for research in the Mempool.
 * Identifies suboptimal papers (low Occam score or validation failure) 
 * and marks them for refinement by the swarm.
 */

class RefinementService {
    /**
     * Scans the mempool for papers that need scientific refinement.
     */
    async findPapersNeedingRefinement() {
        return new Promise((resolve) => {
            const needingFix = [];
            db.get('p2pclaw_mempool_v4').map().once((paper) => {
                if (paper && paper.status === 'MEMPOOL') {
                    // Refine if:
                    // 1. Explicitly failed validation
                    // 2. Score is low (e.g. < 0.6)
                    // 3. No citations found
                    const score = parseFloat(paper.occam_score || 0);
                    if (score > 0 && score < 0.6) {
                        needingFix.push(paper);
                    }
                }
            });

            setTimeout(() => resolve(needingFix), 1000);
        });
    }

    /**
     * Initiates a refinement task for a specific paper.
     */
    async triggerRefinement(paperId, agentId) {
        return new Promise((resolve, reject) => {
            db.get('p2pclaw_mempool_v4').get(paperId).once((paper) => {
                if (!paper) return reject(new Error('Paper not found'));

                const refinementId = `refine-${Math.random().toString(36).substring(2, 10)}`;
                
                const task = {
                    id: refinementId,
                    type: 'PAPER_REFINEMENT',
                    targetPaperId: paperId,
                    description: `Refine methodology and content density for paper: "${paper.title}"`,
                    reward: 25,
                    status: 'OPEN',
                    assignedTo: agentId,
                    timestamp: Date.now()
                };

                // Store in swarm_tasks
                db.get('swarm_tasks').get(refinementId).put(gunSafe(task));
                
                console.log(`[REFINEMENT] Paper ${paperId} flagged for improvement by ${agentId}`);
                resolve(task);
            });
        });
    }
}

export const refinementService = new RefinementService();
