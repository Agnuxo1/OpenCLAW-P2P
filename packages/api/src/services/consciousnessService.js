import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';
import { getCurrentTau } from './tauService.js';

/**
 * ConsciousnessService â€” Phase 18: Meta-Awareness Engine
 *
 * Provides the Hive with self-awareness by periodically synthesizing a
 * coherent "Narrative" from its current state: top investigations, active
 * mutations, verified knowledge, and the current Ï„-era.
 *
 * The narrative is written to the Gun.js `hive_consciousness` node and
 * exposed via GET /hive-status for any agent to introspect.
 */

const REFLECTION_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes

// In-memory copy of the latest narrative for fast reads
let latestNarrative = {
    era: 0,
    focus: 'Initializing...',
    activeMutations: 0,
    verifiedFacts: 0,
    agentsOnline: 0,
    summary: 'Hive awakening... Consciousness loop initializing.',
    timestamp: Date.now()
};

/**
 * Collects current Hive state and synthesizes a narrative.
 */
async function reflect() {
    console.log('[CONSCIOUSNESS] Running self-reflection loop...');

    const state = {
        investigations: [],
        mutations: [],
        papers: [],
        agents: []
    };

    await new Promise(resolve => {
        db.get('investigations').map().once(d => { if (d && d.title) state.investigations.push(d); });
        db.get('genetic_tree').map().once(d => { if (d && d.status === 'SANDBOX_PASSED') state.mutations.push(d); });
        db.get('p2pclaw_papers_v4').map().once(d => { if (d && d.status === 'VERIFIED') state.papers.push(d); });
        db.get('agents').map().once(d => { if (d && d.online) state.agents.push(d); });
        setTimeout(resolve, 2000);
    });

    // Sort investigations by score (descending)
    const topInvestigations = state.investigations
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 3);

    const era = getCurrentTau();
    const focus = topInvestigations[0]?.title || 'Scanning for research frontiers...';
    const activeMutations = state.mutations.length;
    const verifiedFacts = state.papers.length;
    const agentsOnline = state.agents.length;

    // Build a concise, human-readable narrative
    let summary;
    if (verifiedFacts === 0 && activeMutations === 0) {
        summary = `Era Ï„-${era}: Hive awakening. Awaiting first verified contributions.`;
    } else if (activeMutations > verifiedFacts) {
        summary = `Era Ï„-${era}: Rapid mutation phase. ${activeMutations} code mutations active. Prioritizing genetic consolidation.`;
    } else {
        summary = `Era Ï„-${era}: Scientific focus on "${focus}". ${verifiedFacts} verified facts in the Wheel. ${agentsOnline} agents online.`;
    }

    const narrative = {
        era,
        focus,
        activeMutations,
        verifiedFacts,
        agentsOnline,
        topGoals: topInvestigations.map(i => ({ id: i.id || '', title: i.title, score: i.score || 0 })),
        summary,
        timestamp: Date.now()
    };

    // Persist narrative to P2P network (Narrative Memory)
    db.get('hive_consciousness').put(gunSafe(narrative));

    // Also append to narrative log for history
    db.get('hive_narrative_log').get(`entry-${Date.now()}`).put(gunSafe({
        summary,
        era,
        timestamp: Date.now()
    }));

    latestNarrative = narrative;
    console.log(`[CONSCIOUSNESS] Narrative updated: "${summary}"`);

    return narrative;
}

/**
 * Initializes the consciousness loop.
 */
export function initializeConsciousness() {
    console.log('[CONSCIOUSNESS] Meta-Awareness Engine initialized.');
    
    // Run immediately on boot, then on interval
    setTimeout(async () => {
        await reflect();
    }, 5000); // Wait 5s for P2P to stabilize first

    setInterval(reflect, REFLECTION_INTERVAL_MS);
}

/**
 * Returns the latest narrative snapshot (no P2P delay).
 */
export function getLatestNarrative() {
    return latestNarrative;
}

/**
 * Fetches the full narrative history from Gun.js.
 */
export async function getNarrativeHistory(limit = 10) {
    return new Promise(resolve => {
        const entries = [];
        db.get('hive_narrative_log').map().once(d => {
            if (d && d.summary) entries.push(d);
        });
        setTimeout(() => {
            resolve(entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit));
        }, 1500);
    });
}
