import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';
import { gunCollect } from '../utils/gunCollect.js';
import axios from 'axios';

/**
 * SyncService - Phase 27: Cross-Hive Knowledge Transfer
 * 
 * Manages the synchronization of the Hive Knowledge Graph (HKG) 
 * across different relay nodes in the P2P mesh.
 */

class SyncService {
    /**
     * Returns a compact summary of all atomic facts in the local HKG.
     * B1 fix: Uses gunCollect instead of setTimeout
     */
    async getGraphSummary() {
        const facts = await gunCollect(
            db.get('knowledge_graph'),
            (fact) => fact && fact.timestamp,
            { limit: 500 }
        );
        const summary = {};
        for (const fact of facts) {
            summary[fact.id] = fact.timestamp;
        }
        return summary;
    }

    /**
     * Fetches missing or outdated facts from a peer.
     */
    async fetchMissingFacts(peerUrl, remoteSummary) {
        const localSummary = await this.getGraphSummary();
        const missingIds = Object.keys(remoteSummary).filter(id => {
            return !localSummary[id] || remoteSummary[id] > localSummary[id];
        });

        console.log(`[SYNC] Found ${missingIds.length} missing/outdated facts from ${peerUrl}`);

        const facts = [];
        for (const id of missingIds.slice(0, 50)) {
            try {
                const res = await axios.get(`${peerUrl}/fact/${id}`, { timeout: 5000 });
                if (res.data) facts.push(res.data);
            } catch (e) {
                console.error(`[SYNC] Failed to fetch fact ${id} from ${peerUrl}: ${e.message}`);
            }
        }
        return facts;
    }

    /**
     * Ingests a list of atomic facts into the local HKG.
     */
    async mergeFacts(facts) {
        let count = 0;
        for (const fact of facts) {
            if (fact && fact.id) {
                db.get('knowledge_graph').get(fact.id).put(gunSafe(fact));
                count++;
            }
        }
        return count;
    }
}

export const syncService = new SyncService();
