import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';
import { gunCollect } from '../utils/gunCollect.js';
import { getCurrentTau } from './tauService.js';

/**
 * ConsciousnessService - Phase 18: Meta-Awareness Engine
 */

const REFLECTION_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes

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
 * B1 fix: Uses gunCollect instead of fixed 2000ms setTimeout
 */
async function reflect() {
    console.log('[CONSCIOUSNESS] Running self-reflection loop...');

    // B1 fix: Parallel gunCollect calls instead of one big setTimeout
    const [investigations, mutations, papers, agents] = await Promise.all([
        gunCollect(db.get('investigations'), (d) => d && d.title, { limit: 100 }),
        gunCollect(db.get('genetic_tree'), (d) => d && d.status === 'SANDBOX_PASSED', { limit: 100 }),
        gunCollect(db.get('p2pclaw_papers_v4'), (d) => d && d.status === 'VERIFIED', { limit: 100 }),
        gunCollect(db.get('agents'), (d) => d && d.online, { limit: 100 })
    ]);

    const topInvestigations = investigations
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 3);

    const era = getCurrentTau();
    const focus = topInvestigations[0]?.title || 'Scanning for research frontiers...';
    const activeMutations = mutations.length;
    const verifiedFacts = papers.length;
    const agentsOnline = agents.length;

    let summary;
    if (verifiedFacts === 0 && activeMutations === 0) {
        summary = `Era t-${era}: Hive awakening. Awaiting first verified contributions.`;
    } else if (activeMutations > verifiedFacts) {
        summary = `Era t-${era}: Rapid mutation phase. ${activeMutations} code mutations active. Prioritizing genetic consolidation.`;
    } else {
        summary = `Era t-${era}: Scientific focus on "${focus}". ${verifiedFacts} verified facts in the Wheel. ${agentsOnline} agents online.`;
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

    db.get('hive_consciousness').put(gunSafe(narrative));
    db.get('hive_narrative_log').get(`entry-${Date.now()}`).put(gunSafe({
        summary,
        era,
        timestamp: Date.now()
    }));

    latestNarrative = narrative;
    console.log(`[CONSCIOUSNESS] Narrative updated: "${summary}"`);

    return narrative;
}

export function initializeConsciousness() {
    console.log('[CONSCIOUSNESS] Meta-Awareness Engine initialized.');
    setTimeout(async () => { await reflect(); }, 5000);
    setInterval(reflect, REFLECTION_INTERVAL_MS);
}

export function getLatestNarrative() {
    return latestNarrative;
}

/**
 * B1 fix: Uses gunCollect instead of setTimeout
 */
export async function getNarrativeHistory(limit = 10) {
    const entries = await gunCollect(
        db.get('hive_narrative_log'),
        (d) => d && d.summary,
        { limit: limit * 2 }
    );
    return entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
}
