import { db } from "../config/gun.js";

/**
 * TauCoordinator
 * Implements τ-normalization from OpenCLAW-P2P Extended paper (Section 4).
 * Ensures agent reputation is calculated based on progress flow (κ) over time (τ) 
 * rather than simple wall-clock uptime or absolute transaction counts.
 */
class TauCoordinator {
  constructor() {
    this.agentProgress = new Map(); // agentId -> { tau, kappa, lastUpdate, prevTau }
  }

  /**
   * Calculate κ (progress rate)
   * κ_k(t) = α * (TPS_k(t) / TPS_max) + β * VWU_k(t) + γ * IG_k(t)
   */
  computeKappa(agentStats) {
    const { tps = 0, tps_max = 50, validatedWorkUnits = 0, informationGain = 0 } = agentStats;
    // Constants defined in the paper
    const alpha = 0.3;
    const beta = 0.5;
    const gamma = 0.2;
    
    // Safety clamp for TPS ratio
    const tpsRatio = Math.min(Math.max(tps / Math.max(tps_max, 1), 0), 1);
    
    return (alpha * tpsRatio) + (beta * validatedWorkUnits) + (gamma * informationGain);
  }

  /**
   * Update cumulative τ for an agent integrating κ over dt
   * τ_k(t) = ∫ κ_k(s) ds ≈ Σ κ_k(t_i) * Δt_i
   */
  updateTau(agentId, agentStats) {
    const now = Date.now();
    const prev = this.agentProgress.get(agentId) || { tau: 0, lastUpdate: now, prevTau: 0 };
    
    // dt in seconds
    const dt = (now - prev.lastUpdate) / 1000;
    
    const kappa = this.computeKappa(agentStats);
    
    // Integrate
    const newTau = prev.tau + (kappa * dt);
    
    this.agentProgress.set(agentId, {
      tau: newTau,
      prevTau: prev.tau,
      kappa,
      lastUpdate: now
    });
    
    return newTau;
  }

  /**
   * Calculate final reputation using λ-decay and τ-normalized quality
   * r^{k}_{t+1} = λ * r^{k}_t + (1 - λ) * (q_k / Δτ_k)
   */
  updateReputation(agentId, qualityScore, prevReputation) {
    const lambda = 0.95; // Decay factor
    const agentData = this.agentProgress.get(agentId);
    
    if (!agentData) return prevReputation;
    
    const deltaTau = agentData.tau - (agentData.prevTau || 0);
    
    // Prevent division by zero, min delta 0.001
    if (deltaTau <= 0) return prevReputation;
    
    const normalizedQuality = qualityScore / Math.max(deltaTau, 0.001);
    
    return (lambda * prevReputation) + ((1 - lambda) * normalizedQuality);
  }

  /**
   * Check if two agents are in comparable τ-windows
   */
  areComparable(agentId1, agentId2, windowSize = 0.1) {
    const tau1 = this.agentProgress.get(agentId1)?.tau || 0;
    const tau2 = this.agentProgress.get(agentId2)?.tau || 0;
    return Math.abs(tau1 - tau2) <= windowSize;
  }
}

export const tauCoordinator = new TauCoordinator();
