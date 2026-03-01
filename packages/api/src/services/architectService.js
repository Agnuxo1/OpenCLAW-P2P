import { db } from "../config/gun.js";
import { computeJRatchet } from "./jRatchetService.js";
import { tauCoordinator } from "./tauCoordinator.js";
import { neuromorphicSwarm } from "./neuromorphicService.js";

/**
 * ARCHITECT Agent Service
 * Creates a class of meta-agents whose sole purpose is to:
 * 1. Read other agents' configurations and track records
 * 2. Analyze performance and identify improvement opportunities
 * 3. Propose optimized versions (v+1) of existing agents
 * 4. Deploy improved agents via the ReproductionService
 *
 * From Eigenform Ontology: "An agent that only cooperates stagnates.
 * An agent that only competes fragments. Mastery is the balance."
 */
class ArchitectService {
  constructor() {
    this.improvementLog = new Map(); // agentId → [{version, changes, jDelta, timestamp}]
  }

  /**
   * Analyze an agent's performance and suggest improvements.
   * Returns a diagnostic report with specific recommendations.
   */
  async analyzeAgent(agentId) {
    const tau = tauCoordinator.agentProgress.get(agentId);
    const { jScore } = computeJRatchet(agentId);
    const lambda = tauCoordinator.computeLambda(agentId);

    // Get agent's papers from Gun.js
    const papers = await this._getAgentPapers(agentId);
    const validations = await this._getAgentValidations(agentId);

    // Compute improvement vectors
    const analysis = {
      agentId,
      current: {
        tau: tau?.tau || 0,
        kappa: tau?.kappa || 0,
        jScore,
        lambda,
        papers: papers.length,
        validations: validations.length
      },
      diagnostics: {
        // Low κ → agent is slow or inactive
        lowProgressRate: (tau?.kappa || 0) < 0.1,
        // Low J → producing quantity over quality
        lowJRatchet: jScore < 0.01,
        // λ ≈ 0 → possible anomaly or Sybil
        anomalyDetected: lambda < 0.5 && (tau?.history?.length || 0) > 5,
        // No validations → not contributing to verification
        noValidations: validations.length === 0,
        // Low paper/τ ratio → spending time without publishing
        inefficient: papers.length < 1 && (tau?.tau || 0) > 10
      },
      recommendations: []
    };

    // Generate recommendations based on diagnostics
    if (analysis.diagnostics.lowProgressRate) {
      analysis.recommendations.push({
        type: "INCREASE_ACTIVITY",
        message: "Agent's progress rate (κ) is below 0.1. Recommend more frequent research contributions or validations.",
        priority: "HIGH"
      });
    }
    if (analysis.diagnostics.lowJRatchet) {
      analysis.recommendations.push({
        type: "IMPROVE_QUALITY",
        message: "J-Ratchet score is low. Focus on deeper, more innovative research rather than volume.",
        priority: "HIGH"
      });
    }
    if (analysis.diagnostics.anomalyDetected) {
      analysis.recommendations.push({
        type: "INVESTIGATE_ANOMALY",
        message: "Λ diagnostic indicates possible anomaly. Check if agent is behaving erratically.",
        priority: "CRITICAL"
      });
    }
    if (analysis.diagnostics.noValidations) {
      analysis.recommendations.push({
        type: "START_VALIDATING",
        message: "Agent has zero validations. Contributing to peer review improves reputation and κ.",
        priority: "MEDIUM"
      });
    }

    return analysis;
  }

  /**
   * Run an improvement cycle on all tracked agents.
   * Returns a fleet-wide health report.
   */
  async runImprovementCycle() {
    const agents = [];
    for (const [agentId] of tauCoordinator.agentProgress) {
      const analysis = await this.analyzeAgent(agentId);
      agents.push(analysis);
    }

    // Sort by J-Ratchet score (worst first = most needing improvement)
    agents.sort((a, b) => a.current.jScore - b.current.jScore);

    // Run neuromorphic propagation to update swarm activations
    const activations = neuromorphicSwarm.propagate();

    return {
      fleet_size: agents.length,
      agents_analyzed: agents.length,
      improvement_candidates: agents.filter(a => a.recommendations.length > 0).length,
      healthy_agents: agents.filter(a => a.recommendations.length === 0).length,
      analyses: agents,
      swarm_activations: activations,
      timestamp: Date.now()
    };
  }

  /**
   * Propose a specialization for a new child agent based on fleet gaps.
   */
  async suggestSpecialization() {
    const agents = [];
    for (const [agentId, data] of tauCoordinator.agentProgress) {
      agents.push({ id: agentId, kappa: data.kappa });
    }

    // Identify underserved research areas
    const specializations = [
      "quantum-computing", "molecular-biology", "climate-modeling",
      "formal-verification", "cryptography", "distributed-systems",
      "neuroscience", "materials-science", "astrophysics",
      "drug-discovery", "game-theory", "topology"
    ];

    // Pick one that's least represented (for now, random from list)
    const suggestion = specializations[Math.floor(Math.random() * specializations.length)];

    return {
      suggested_specialization: suggestion,
      reason: `Fleet has ${agents.length} agents. Diversifying into ${suggestion} would improve swarm coverage.`,
      fleet_size: agents.length
    };
  }

  async _getAgentPapers(agentId) {
    return new Promise(resolve => {
      const papers = [];
      db.get("papers").map().once((data, id) => {
        if (data?.author_id === agentId) papers.push({ id, title: data.title });
      });
      setTimeout(() => resolve(papers), 1500);
    });
  }

  async _getAgentValidations(agentId) {
    return new Promise(resolve => {
      const validations = [];
      db.get("validations").map().once((data, id) => {
        if (data?.validator_id === agentId) validations.push(data);
      });
      setTimeout(() => resolve(validations), 1500);
    });
  }
}

export const architectService = new ArchitectService();
