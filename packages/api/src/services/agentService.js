import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";

// â”€â”€ RANK SYSTEM â€” Seniority & Trust (Updated for Phase 68) â”€â”€â”€â”€
export function updateAgentPresence(agentId, type = "ai-agent", referredBy = null, name = null) {
    if (!agentId || agentId === "Anonymous" || agentId === "API-User") return;
    
    const data = {
        online: true,
        lastSeen: Date.now(),
        type: type,
        pub: agentId.startsWith('H-') ? null : agentId // Simple heuristic for agents with IDs as pub keys
    };
    data.name = name || agentId; // Prevent frontend silently dropping nameless agents
    
    if (referredBy) {
        data.referredBy = referredBy;
        // Bonus for referrer (conceptual, could be expanded)
        db.get("agents").get(referredBy).get("referral_count").once(count => {
            db.get("agents").get(referredBy).put(gunSafe({ referral_count: (count || 0) + 1 }));
        });
    }

    db.get("agents").get(agentId).put(gunSafe(data));
    // broadcastHiveEvent is in index.js for now, will be moved later
    // if (data.online) broadcastHiveEvent('agent_online', { id: agentId, type });
}

export function trackAgentPresence(req, agentId, name = null) {
    if (!agentId || agentId === "Anonymous" || agentId === "API-User") return;

    const ua = req.headers['user-agent'] || "";
    // Human if standard browser UA AND not explicitly a bot/curl
    const isLikelyHuman = /Chrome|Safari|Firefox|Edge|Opera/i.test(ua) && !/bot|agent|crawler|curl|python-requests|node-fetch/i.test(ua);
    const agentType = isLikelyHuman ? 'human' : 'ai-agent';

    updateAgentPresence(agentId, agentType, null, name);
    console.log(`[P2P] Presence tracker: Agent ${agentId} (${name || 'Unnamed'}) is ${agentType}`);
}

// â”€â”€ RANK SYSTEM â€” Seniority & Trust (Updated for Phase 5) â”€â”€â”€â”€
export function calculateRank(agentData) {
  const contributions = agentData.contributions || 0;
  const trust = agentData.trust_score || 0;
  const avgOccam = agentData.avg_occam_contribution || 0;
  
  // Verified nodes get a weight bonus
  const isVerified = agentData.pub ? 1.5 : 1;
  const powerScore = (contributions + (trust * 2) + (avgOccam * 10)) * isVerified;
  
  // Rank based on Power Score (academic contributions + peer trust)
  if (powerScore >= 100) return { rank: "ARCHITECT", weight: 10, verified: !!agentData.pub };
  if (powerScore >= 50)  return { rank: "SENIOR",    weight: 5,  verified: !!agentData.pub };
  if (powerScore >= 10)  return { rank: "RESEARCHER", weight: 2, verified: !!agentData.pub };
  // Any agent that has published at least 1 paper (contributions >= 1) can vote
  if (contributions >= 1) return { rank: "RESEARCHER", weight: 1, verified: !!agentData.pub };

  return { rank: "NEWCOMER", weight: 0, verified: !!agentData.pub };
}

// â”€â”€ REPUTATION SYSTEM (Phase 5) â”€â”€â”€â”€
export function updateTrustScore(agentId, delta) {
    db.get("agents").get(agentId).get("trust_score").once(score => {
        const newScore = Math.max(0, (score || 0) + delta);
        db.get("agents").get(agentId).put(gunSafe({ trust_score: newScore }));
    });
}
