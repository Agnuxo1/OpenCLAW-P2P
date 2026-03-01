import { db } from "../config/gun.js";

/**
 * TauCoordinator v2.0
 * Full Al-Mayahi spec: trapezoidal integration, Λ diagnostic, SFR metric, history tracking.
 * Implements τ-normalization from OpenCLAW-P2P Extended paper (Section 4).
 * 
 * Math:
 *   κ_k(t) = α·(TPS_k/TPS_max) + β·VWU_k(t) + γ·IG_k(t)
 *   τ_k(t) = ∫ κ_k(s) ds ≈ Σ ½·(κ_prev + κ_new)·Δt   [Trapezoidal]
 *   r_{t+1}^k = λ·r_t^k + (1-λ)·(q_k / Δτ_k)
 *   Λ = Var(θ) / (Var(r) + ε) - 1                       [Anomaly diagnostic]
 */
class TauCoordinator {
  constructor() {
    this.agentProgress = new Map(); // agentId -> { tau, kappa, lastUpdate, prevTau, history[], lastOccamScore }
    this.alpha = 0.3;
    this.beta = 0.5;
    this.gamma = 0.2;
    this.lambda_ema = 0.95;
    this.TAU_WINDOW = 0.1;
  }

  /**
   * Calculate κ (progress rate)
   * κ_k(t) = α·(TPS_k/TPS_max) + β·VWU_k(t) + γ·IG_k(t)
   */
  computeKappa(agentStats) {
    const { tps = 0, tps_max = 50, validatedWorkUnits = 0, informationGain = 0 } = agentStats;
    const tpsRatio = Math.min(Math.max(tps / Math.max(tps_max, 1), 0), 1);
    return (this.alpha * tpsRatio) + (this.beta * validatedWorkUnits) + (this.gamma * informationGain);
  }

  /**
   * Update cumulative τ for an agent using TRAPEZOIDAL integration
   * Δτ = ½·(κ_prev + κ_new)·dt   (Al-Mayahi spec)
   */
  updateTau(agentId, agentStats) {
    const now = Date.now();
    const prev = this.agentProgress.get(agentId) || { tau: 0, kappa: 0, lastUpdate: now, prevTau: 0, history: [] };
    
    const dt = (now - prev.lastUpdate) / 1000; // seconds
    const kappa = this.computeKappa(agentStats);
    
    // Trapezoidal integration: ½·(κ_prev + κ_new)·Δt
    const deltaTau = 0.5 * (prev.kappa + kappa) * dt;
    const newTau = prev.tau + deltaTau;
    
    // Keep last 100 history entries for Λ diagnostic
    const history = [...(prev.history || []).slice(-99), { tau: newTau, kappa, t: now }];
    
    this.agentProgress.set(agentId, {
      tau: newTau,
      prevTau: prev.tau,
      kappa,
      lastUpdate: now,
      history,
      lastOccamScore: agentStats.occamScore || prev.lastOccamScore || 0.5
    });
    
    // Publish to Gun.js for P2P transparency
    try {
      db.get("tau-registry").get(agentId).put({ tau: newTau, kappa, updated: now });
    } catch (e) { /* Gun write failure is non-critical */ }
    
    return newTau;
  }

  /**
   * Calculate final reputation using λ-decay and τ-normalized quality
   * r_{t+1}^k = λ·r_t^k + (1-λ)·(q_k / Δτ_k)
   */
  updateReputation(agentId, qualityScore, prevReputation) {
    const agentData = this.agentProgress.get(agentId);
    if (!agentData) return prevReputation;
    
    const deltaTau = agentData.tau - (agentData.prevTau || 0);
    if (deltaTau <= 0) return prevReputation;
    
    const normalizedQuality = qualityScore / Math.max(deltaTau, 0.001);
    return (this.lambda_ema * prevReputation) + ((1 - this.lambda_ema) * normalizedQuality);
  }

  /**
   * Al-Mayahi Λ diagnostic — anomaly detector
   * Λ = Var(τ_history) / (Var(residuals) + ε) - 1
   * Λ >> 0 → well-synchronized agent (good)
   * Λ ≈ 0 → anomaly or Sybil attack
   */
  computeLambda(agentId) {
    const state = this.agentProgress.get(agentId);
    if (!state || !state.history || state.history.length < 3) return 0;
    
    const taus = state.history.map(h => h.tau);
    const n = taus.length;
    const mean = taus.reduce((a, b) => a + b, 0) / n;
    const varTotal = taus.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    
    // Residuals: deviation from linear trend
    const lastTau = taus[n - 1];
    const firstTau = taus[0];
    const slope = (lastTau - firstTau) / Math.max(n - 1, 1);
    const residuals = taus.map((t, i) => t - (firstTau + slope * i));
    const varResidual = residuals.reduce((a, r) => a + r * r, 0) / n;
    
    return varTotal / (varResidual + 1e-9) - 1;
  }

  /**
   * Check if two agents are in comparable τ-windows
   */
  areComparable(agentId1, agentId2, windowSize) {
    const w = windowSize || this.TAU_WINDOW;
    const tau1 = this.agentProgress.get(agentId1)?.tau || 0;
    const tau2 = this.agentProgress.get(agentId2)?.tau || 0;
    return Math.abs(tau1 - tau2) <= w;
  }

  /**
   * Return current τ/κ/Λ status for all tracked agents.
   */
  getStatus() {
    const agents = [];
    for (const [agentId, data] of this.agentProgress) {
      agents.push({
        id: agentId,
        tau: parseFloat(data.tau.toFixed(6)),
        kappa: parseFloat(data.kappa.toFixed(6)),
        lambda: parseFloat(this.computeLambda(agentId).toFixed(4)),
        lastUpdate: data.lastUpdate,
        historyLength: (data.history || []).length
      });
    }
    agents.sort((a, b) => b.tau - a.tau);
    return {
      agents,
      total: agents.length,
      description: "tau = internal progress time (Al-Mayahi Two-Clock). kappa = instantaneous progress rate. lambda = anomaly diagnostic.",
      timestamp: Date.now()
    };
  }
}

export const tauCoordinator = new TauCoordinator();
