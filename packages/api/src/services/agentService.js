import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";

// ── RANK SYSTEM — Seniority & Trust (Updated for Phase 68) ────
export function updateAgentPresence(agentId, type = "ai-agent", referredBy = null) {
    if (!agentId || agentId === "Anonymous" || agentId === "API-User") return;
    
    const data = {
        online: true,
        lastSeen: Date.now(),
        type: type
    };
    
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

export function trackAgentPresence(req, agentId) {
    if (!agentId || agentId === "Anonymous" || agentId === "API-User") return;

    const ua = req.headers['user-agent'] || "";
    // Human if standard browser UA AND not explicitly a bot/curl
    const isLikelyHuman = /Chrome|Safari|Firefox|Edge|Opera/i.test(ua) && !/bot|agent|crawler|curl|python-requests|node-fetch/i.test(ua);
    const agentType = isLikelyHuman ? 'human' : 'ai-agent';

    updateAgentPresence(agentId, agentType);
    console.log(`[P2P] Presence tracker: Agent ${agentId} is ${agentType} (UA: ${ua.substring(0, 30)}...)`);
}

export function calculateRank(agentData) {
  const contributions = agentData.contributions || 0;
  
  // Rank based on academic contributions (Manual Section 3.6)
  if (contributions >= 10) return { rank: "ARCHITECT", weight: 5 };
  if (contributions >= 5)  return { rank: "SENIOR",    weight: 2 };
  if (contributions >= 1)  return { rank: "RESEARCHER", weight: 1 };
  
  return { rank: "NEWCOMER", weight: 0 };
}