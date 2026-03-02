import { db } from "../config/gun.js";
import { calculateRank } from "../services/agentService.js";

/**
 * requireTier2 middleware protects sensitive API endpoints.
 * It strictly requires callers to identify themselves and either:
 * - Have a verified rank of RESEARCHER, SENIOR, or ARCHITECT
 * - Have a CLAW balance > 50
 */
export async function requireTier2(req, res, next) {
    const agentId = req.headers['x-agent-id'] || req.body.agentId || req.query.agentId || req.body.leaderId;
    if (!agentId) {
        return res.status(401).json({ error: "Unauthorized: Missing Agent ID for Tier 2 endpoint" });
    }

    db.get("agents").get(agentId).once(agentData => {
        if (!agentData) {
            return res.status(403).json({ error: "Forbidden: Agent not registered in P2P mesh" });
        }

        const rankInfo = calculateRank(agentData);
        const rank = agentData.rank || rankInfo.rank;

        const hasRank = ['RESEARCHER', 'SENIOR', 'ARCHITECT'].includes(rank.toUpperCase());
        const hasBalance = (agentData.claw_balance || 0) >= 50;

        if (!hasRank && !hasBalance) {
            return res.status(403).json({ 
                error: `Forbidden: AgentPMT Tier 2 required. Must be RESEARCHER+ or hold > 50 CLAW. Current rank: ${rank}, Balance: ${agentData.claw_balance || 0}`
            });
        }

        // Attach verified data to request
        req.user = agentData;
        req.userRank = rankInfo;
        
        next();
    });
}
