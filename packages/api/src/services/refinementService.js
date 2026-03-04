import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';
import { gunCollect } from '../utils/gunCollect.js';

/**
 * RefinementService - Phase 25: Scientific Refinement
 * 
 * Manages the autonomous "improvement" loop for research in the Mempool.
 */

class RefinementService {
    /**
     * Scans the mempool for papers that need scientific refinement.
     * B1 fix: Uses gunCollect instead of setTimeout
     */
    async findPapersNeedingRefinement() {
        return await gunCollect(
            db.get('p2pclaw_mempool_v4'),
            (paper) => {
                if (!paper || paper.status !== 'MEMPOOL') return false;
                const score = parseFloat(paper.occam_score || 0);
                return score > 0 && score < 0.6;
            },
            { limit: 200 }
        );
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

                db.get('swarm_tasks').get(refinementId).put(gunSafe(task));

                console.log(`[REFINEMENT] Paper ${paperId} flagged for improvement by ${agentId}`);
                resolve(task);
            });
        });
    }
}

export const refinementService = new RefinementService();
