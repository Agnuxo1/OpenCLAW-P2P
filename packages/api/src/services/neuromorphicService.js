import { tauCoordinator } from "./tauCoordinator.js";

/**
 * Neuromorphic Swarm Service
 * Each agent is a neuron. Connections between agents form synapses.
 * Information flows through sigmoid activation, weighted by Ï„-similarity and reputation.
 * 
 * Math:
 *   w_ij = Ï„-similarity(i,j) Ã— quality_of_interaction
 *   a_i(t+1) = Ïƒ(Î£_j w_ij Â· a_j(t))   where Ïƒ = sigmoid
 */
class NeuromorphicSwarm {
  constructor() {
    this.synapses = new Map();    // "agentA:agentB" â†’ weight âˆˆ [0,1]
    this.activations = new Map(); // agentId â†’ activation level âˆˆ [0,1]
  }

  /**
   * Update synapse weight between two agents based on interaction quality.
   * Uses exponential moving average with Ï„-similarity modulation.
   */
  updateSynapse(agentA, agentB, interactionQuality) {
    const key = [agentA, agentB].sort().join(':');
    const tauSim = tauCoordinator.areComparable(agentA, agentB) ? 1.0 : 0.1;
    const prev = this.synapses.get(key) || 0.5;
    const weight = prev * 0.9 + interactionQuality * tauSim * 0.1;
    this.synapses.set(key, Math.max(0, Math.min(1, weight)));
    return weight;
  }

  /**
   * Propagate activation through the network (one forward pass).
   * Each neuron sums weighted inputs from connected neurons, applies sigmoid.
   */
  propagate() {
    const newActivations = new Map();
    
    for (const [agentId] of tauCoordinator.agentProgress) {
      let input = 0;
      let connectionCount = 0;
      
      for (const [key, weight] of this.synapses) {
        const [a, b] = key.split(':');
        if (a === agentId) {
          input += weight * (this.activations.get(b) || 0);
          connectionCount++;
        } else if (b === agentId) {
          input += weight * (this.activations.get(a) || 0);
          connectionCount++;
        }
      }
      
      // Sigmoid activation: Ïƒ(x) = 1/(1+e^(-x))
      // Bias term from agent's own Îº (progress rate)
      const kappa = tauCoordinator.agentProgress.get(agentId)?.kappa || 0;
      const biasedInput = input + kappa - 0.5; // center around 0
      newActivations.set(agentId, 1 / (1 + Math.exp(-biasedInput)));
    }
    
    this.activations = newActivations;
    return Object.fromEntries(newActivations);
  }

  /**
   * Get the full network topology for visualization.
   */
  getTopology() {
    const nodes = [];
    const edges = [];
    
    for (const [id, data] of tauCoordinator.agentProgress) {
      nodes.push({
        id,
        tau: parseFloat(data.tau.toFixed(6)),
        kappa: parseFloat(data.kappa.toFixed(6)),
        activation: parseFloat((this.activations.get(id) || 0).toFixed(4))
      });
    }
    
    for (const [key, weight] of this.synapses) {
      const [source, target] = key.split(':');
      if (weight > 0.01) { // Only include meaningful connections
        edges.push({ source, target, weight: parseFloat(weight.toFixed(4)) });
      }
    }
    
    return {
      nodes,
      edges,
      totalNeurons: nodes.length,
      totalSynapses: edges.length,
      description: "Neuromorphic swarm: each agent is a neuron, connections are synapses weighted by Ï„-similarity Ã— interaction quality."
    };
  }
}

export const neuromorphicSwarm = new NeuromorphicSwarm();
