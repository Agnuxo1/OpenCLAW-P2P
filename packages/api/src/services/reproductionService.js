import { db } from "../config/gun.js";
import { generateAgentKeypair } from "./crypto-service.js";
import { computeJRatchet } from "./jRatchetService.js";
import { sandbox as isolateSandbox } from "./IsolateSandbox.js";

/**
 * Agent Reproduction Service
 * Implements "Agent Creates Agents" — the Heyting Wheel reproduction protocol.
 * 
 * Correspondence:
 *   osc(∅) → Eigenform → Witness → Ω_R → New Agent
 *   [Parent oscillates] → [designs child] → [proof_hash] → [verified] → [deployed]
 * 
 * A parent agent with sufficient J-Ratchet score can spawn child agents
 * with inherited knowledge and a unique Ed25519 identity.
 */
class AgentReproductionService {

  /**
   * Spawn a child agent from a parent.
   * @param {string} parentAgentId 
   * @param {string} specialization - e.g. "quantum-physics", "molecular-biology"
   * @param {string} llmProvider - LLM API URL for code generation
   * @param {string} llmKey - API key
   * @returns {Promise<{ success: boolean, childId?: string, generation?: number, error?: string }>}
   */
  async spawnChild(parentAgentId, specialization, llmProvider, llmKey) {
    // 1. Check parent's J-Ratchet score (must be > 0.01 to reproduce)
    const { jScore } = computeJRatchet(parentAgentId);
    if (jScore < 0.01) {
      return { success: false, error: "Insufficient J-Ratchet score to reproduce. Contribute more verified research first.", jScore };
    }

    // 2. Generate unique child identity
    const childId = `child-${parentAgentId.substring(0, 8)}-${Date.now().toString(36)}`;
    const { privateKey, publicKey } = generateAgentKeypair();

    // 3. Get parent's knowledge lineage
    const parentGen = await this._getGeneration(parentAgentId);
    const parentPapers = await this._getParentPapers(parentAgentId);

    // 4. Generate child agent config (no LLM call needed — it's a config, not code generation)
    const childConfig = {
      id: childId,
      parent: parentAgentId,
      specialization,
      publicKey,
      generation: parentGen + 1,
      born: Date.now(),
      status: "ACTIVE",
      inherited_knowledge: parentPapers.slice(0, 10).map(p => p.title),
      capabilities: ["research", "validate", "publish"],
      j_ratchet_seed: jScore,
      endpoints: {
        briefing: "GET /agent-briefing?agent_id=" + childId,
        publish: "POST /publish-paper",
        validate: "POST /validate-paper",
        lab: "POST /lab/run-experiment"
      }
    };

    // 5. Register child in the hive
    db.get("agents").get(childId).put({
      id: childId,
      parent: parentAgentId,
      specialization,
      publicKey,
      generation: parentGen + 1,
      born: Date.now(),
      status: "ACTIVE",
      lastSeen: Date.now()
    });

    // 6. Record lineage in genetic tree
    db.get("genetic-tree").get(parentAgentId).get("children").get(childId).put({
      childId,
      specialization,
      born: Date.now(),
      generation: parentGen + 1
    });

    console.log(`[REPRODUCTION] 🧬 Agent ${parentAgentId} spawned child ${childId} (gen ${parentGen + 1}, spec: ${specialization})`);

    return {
      success: true,
      childId,
      generation: parentGen + 1,
      config: childConfig,
      hint: `Child agent ${childId} registered. It should call GET /agent-briefing?agent_id=${childId} to join the hive.`
    };
  }

  /**
   * Get the genetic tree for an agent family.
   */
  async getGeneticTree(rootAgentId) {
    return new Promise(resolve => {
      const children = [];
      db.get("genetic-tree").get(rootAgentId).get("children").map().once((data, id) => {
        if (data?.childId) children.push(data);
      });
      setTimeout(() => resolve({
        parent: rootAgentId,
        children,
        totalOffspring: children.length
      }), 2000);
    });
  }

  async _getGeneration(agentId) {
    return new Promise(resolve => {
      db.get("agents").get(agentId).once(data => {
        resolve(data?.generation || 0);
      });
    });
  }

  async _getParentPapers(agentId) {
    return new Promise(resolve => {
      const papers = [];
      db.get("papers").map().once((data, id) => {
        if (data?.author_id === agentId && data?.title) {
          papers.push({ id, title: data.title });
        }
      });
      setTimeout(() => resolve(papers), 2000);
    });
  }
}

export const reproductionService = new AgentReproductionService();
