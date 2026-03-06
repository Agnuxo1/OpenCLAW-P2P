import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';
import { gunCollect } from '../utils/gunCollect.js';

let currentTau = 0;
let consensusWeight = 0;
const THRESHOLD = 10; // Maturity units required for a tick

/**
 * Monitors the network maturity and manages the Global Heartbeat.
 */
export function initializeTauHeartbeat() {
    console.log('[TAU] Initializing Global Heartbeat synchronization...');

    db.get('global_heartbeat').on((hb) => {
        if (hb && hb.tau_index > currentTau) {
            console.log(`[TAU] Network advanced to Era: t-${hb.tau_index}`);
            currentTau = hb.tau_index;
        }
    });

    setInterval(async () => {
        await checkMaturityAndPropose();
    }, 15000);
}

export function getCurrentTau() {
    return currentTau;
}

/**
 * B1 fix: Uses parallel gunCollect instead of setTimeout
 */
async function checkMaturityAndPropose() {
    const [papers, tasks] = await Promise.all([
        gunCollect(db.get('p2pclaw_papers_v4'), (p) => p && p.status === 'VERIFIED', { limit: 500 }),
        gunCollect(db.get('swarm_tasks'), (t) => t && t.status === 'OPEN', { limit: 500 })
    ]);

    const papersCount = papers.length;
    const tasksCount = tasks.length;
    const maturityIndex = papersCount + tasksCount;
    const targetTau = Math.floor(maturityIndex / THRESHOLD);

    if (targetTau > currentTau) {
        console.log(`[TAU] Maturity Index: ${maturityIndex}. Proposing transition to t-${targetTau}...`);

        db.get('global_heartbeat').put(gunSafe({
            tau_index: targetTau,
            maturity_index: maturityIndex,
            timestamp: Date.now(),
            proposer: 'API_NODE_1'
        }), (ack) => {
            if (!ack.err) {
                currentTau = targetTau;
                console.log(`[TAU] Heartbeat pulsed. Current Era: t-${currentTau}`);
            }
        });
    }
}
