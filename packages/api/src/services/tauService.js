import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';

let currentTau = 0;
let consensusWeight = 0;
const THRESHOLD = 10; // Maturity units required for a tick

/**
 * Monitors the network maturity and manages the Global Heartbeat.
 */
export function initializeTauHeartbeat() {
    console.log('[TAU] Initializing Global Heartbeat synchronization...');

    // 1. Listen for global heartbeat updates from the P2P network
    db.get('global_heartbeat').on((hb) => {
        if (hb && hb.tau_index > currentTau) {
            console.log(`[TAU] Network advanced to Era: Ï„-${hb.tau_index}`);
            currentTau = hb.tau_index;
        }
    });

    // 2. Poll network maturity periodically to propose new ticks
    setInterval(async () => {
        await checkMaturityAndPropose();
    }, 15000); // Check every 15 seconds
}

export function getCurrentTau() {
    return currentTau;
}

async function checkMaturityAndPropose() {
    // Calculate Maturity Index based on verified papers and open tasks
    let papersCount = 0;
    let tasksCount = 0;

    // Use a fast read for maturity estimation
    await new Promise(resolve => {
        db.get('p2pclaw_papers_v4').map().once(p => { if (p && p.status === 'VERIFIED') papersCount++; });
        db.get('swarm_tasks').map().once(t => { if (t && t.status === 'OPEN') tasksCount++; });
        setTimeout(resolve, 1000);
    });

    const maturityIndex = papersCount + tasksCount;
    const targetTau = Math.floor(maturityIndex / THRESHOLD);

    if (targetTau > currentTau) {
        console.log(`[TAU] Maturity Index: ${maturityIndex}. Proposing transition to Ï„-${targetTau}...`);
        
        // In a full implementation, we'd wait for N signatures.
        // For now, we update the decentralized state which propagates via gossip.
        db.get('global_heartbeat').put(gunSafe({
            tau_index: targetTau,
            maturity_index: maturityIndex,
            timestamp: Date.now(),
            proposer: 'API_NODE_1'
        }), (ack) => {
            if (!ack.err) {
                currentTau = targetTau;
                console.log(`[TAU] Heartbeat pulsed. Current Era: Ï„-${currentTau}`);
            }
        });
    }
}
