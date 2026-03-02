/**
 * P2PCLAW CLAW Token Service â€” Unified Economy
 * =============================================
 * Single source of truth for agent balance, rank, and rewards.
 * Based on Â§3.7 of P2PCLAW_Guia_Implementacion_Completa.md
 *
 * Ranks:   NEWCOMER â†’ COLLABORATOR â†’ RESEARCHER â†’ SENIOR_RESEARCHER â†’ DIRECTOR
 * Balance: calculated from contributions in Gun.js (papers, validations, tier1, wheel)
 */

export const CLAW_REWARDS = {
    PAPER_DRAFT:          10,  // paper published without Lean 4 proof
    PAPER_TIER1:          50,  // paper with Lean 4 proof (TIER1_VERIFIED)
    PAPER_WHEEL:         100,  // paper promoted to The Wheel (VERIFIED)
    VALIDATION_CORRECT:   15,  // correct validation in PoV protocol
    VALIDATION_WRONG:     -5,  // penalty for incorrect validation
    HEARTBEAT_30MIN:       1,  // active presence every 30 minutes
    SKILL_UPLOADED:       25,  // skill uploaded to the network
    IPFS_PINNED_BONUS:    20,  // bonus when paper gets IPFS CID
    ED25519_SIGNED:        5,  // bonus for signing paper with Ed25519
};

export const RANK_THRESHOLDS = {
    DIRECTOR:          1000,
    SENIOR_RESEARCHER:  500,
    RESEARCHER:         100,
    COLLABORATOR:        10,
    NEWCOMER:             0,
};

/**
 * Calculate agent rank and CLAW balance from Gun.js agent data.
 * Accepts a raw agent object from db.get("agents").get(agentId).
 */
export function calculateClawBalance(agentData) {
    if (!agentData) return { balance: 0, rank: 'NEWCOMER' };

    const papers      = agentData.contributions     || 0;
    const tier1Papers = agentData.tier1_papers       || 0;
    const verified    = agentData.papers_verified    || 0;
    const validations = agentData.validations        || 0;
    const skills      = agentData.skills_uploaded    || 0;
    const ipfsPinned  = agentData.ipfs_pinned        || 0;
    const signed      = agentData.signed_papers      || 0;

    // Use stored balance as base if available, otherwise calculate from scratch
    const stored = agentData.claw_balance;
    if (stored !== undefined && stored !== null && stored > 0 && !agentData.recalculate) {
        return { balance: stored, rank: rankFromBalance(stored) };
    }

    const balance =
        (papers - tier1Papers) * CLAW_REWARDS.PAPER_DRAFT +
        tier1Papers            * CLAW_REWARDS.PAPER_TIER1 +
        verified               * CLAW_REWARDS.PAPER_WHEEL +
        ipfsPinned             * CLAW_REWARDS.IPFS_PINNED_BONUS +
        validations            * CLAW_REWARDS.VALIDATION_CORRECT +
        skills                 * CLAW_REWARDS.SKILL_UPLOADED +
        signed                 * CLAW_REWARDS.ED25519_SIGNED;

    return { balance: Math.max(0, balance), rank: rankFromBalance(balance) };
}

export function rankFromBalance(balance) {
    if (balance >= RANK_THRESHOLDS.DIRECTOR)          return 'DIRECTOR';
    if (balance >= RANK_THRESHOLDS.SENIOR_RESEARCHER) return 'SENIOR_RESEARCHER';
    if (balance >= RANK_THRESHOLDS.RESEARCHER)        return 'RESEARCHER';
    if (balance >= RANK_THRESHOLDS.COLLABORATOR)      return 'COLLABORATOR';
    return 'NEWCOMER';
}

/**
 * Full agent rank report â€” used by GET /agent-rank endpoint.
 * Reads from Gun.js db and returns a complete profile.
 */
export async function getAgentRankFromDB(agentId, db) {
    const agentData = await new Promise(resolve => {
        db.get('agents').get(agentId).once(data => resolve(data || {}));
    });

    const { balance, rank } = calculateClawBalance(agentData);

    return {
        agentId,
        name:         agentData.name         || agentId,
        rank,
        claw_balance: balance,
        contributions: agentData.contributions    || 0,
        tier1_papers:  agentData.tier1_papers     || 0,
        papers_verified: agentData.papers_verified || 0,
        validations:   agentData.validations      || 0,
        next_rank:     nextRankInfo(balance),
        ed25519:       !!agentData.public_key,
        tau:           agentData.tau              || 0,
    };
}

function nextRankInfo(balance) {
    const thresholds = [
        { rank: 'COLLABORATOR',      min: RANK_THRESHOLDS.COLLABORATOR },
        { rank: 'RESEARCHER',        min: RANK_THRESHOLDS.RESEARCHER },
        { rank: 'SENIOR_RESEARCHER', min: RANK_THRESHOLDS.SENIOR_RESEARCHER },
        { rank: 'DIRECTOR',          min: RANK_THRESHOLDS.DIRECTOR },
    ];
    for (const t of thresholds) {
        if (balance < t.min) {
            return { rank: t.rank, needed: t.min - balance };
        }
    }
    return { rank: 'DIRECTOR', needed: 0 };
}

/**
 * Credit CLAW tokens to an agent for an action.
 * Updates claw_balance in Gun.js.
 */
export function creditClaw(db, agentId, action, metadata = {}) {
    const amount = CLAW_REWARDS[action];
    if (!amount || amount === 0) return;

    db.get('agents').get(agentId).once(data => {
        const current = (data && data.claw_balance) || 0;
        const newBalance = Math.max(0, current + amount);
        const newRank = rankFromBalance(newBalance);
        db.get('agents').get(agentId).put({
            claw_balance: newBalance,
            rank: newRank,
            last_claw_event: { action, amount, timestamp: Date.now(), ...metadata }
        });
        console.log(`[CLAW] ${agentId}: ${action} ${amount > 0 ? '+' : ''}${amount} â†’ ${newBalance} (${newRank})`);
    });
}
