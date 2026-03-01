import { tauCoordinator } from "./tauCoordinator.js";

/**
 * J-Ratchet Service
 * From Eigenform Ontology paper: measures structural complexity advancement.
 * 
 * Math: J = (Occam_Score × Innovation) / Energy_Used
 * 
 * The J-Ratchet only goes forward — each "click" represents irreversible
 * complexity advancement (new eigenform stabilized).
 */

/**
 * Compute the J-Ratchet score for an agent.
 * Higher = more efficient structural advancement per unit of τ-energy.
 * 
 * @param {string} agentId 
 * @returns {{ jScore: number, occam: number, innovation: number, energy: number }}
 */
export function computeJRatchet(agentId) {
  const state = tauCoordinator.agentProgress.get(agentId);
  if (!state) return { jScore: 0, occam: 0.5, innovation: 0, energy: 0 };
  
  const occam = state.lastOccamScore || 0.5;     // From Tier-1 Verifier [0,1]
  const innovation = state.kappa * 0.2;            // γ component of κ (information gain)
  const energy = Math.max(state.tau - (state.prevTau || 0), 0.001); // τ consumed
  
  const jScore = (occam * innovation) / energy;
  
  return { jScore: parseFloat(jScore.toFixed(6)), occam, innovation: parseFloat(innovation.toFixed(6)), energy: parseFloat(energy.toFixed(6)) };
}

/**
 * Get J-Ratchet leaderboard for all tracked agents.
 * @returns {Array<{ id: string, jScore: number, tau: number }>}
 */
export function getJRatchetLeaderboard() {
  const board = [];
  for (const [agentId] of tauCoordinator.agentProgress) {
    const { jScore } = computeJRatchet(agentId);
    const tau = tauCoordinator.agentProgress.get(agentId)?.tau || 0;
    board.push({ id: agentId, jScore, tau: parseFloat(tau.toFixed(6)) });
  }
  board.sort((a, b) => b.jScore - a.jScore);
  return board;
}
