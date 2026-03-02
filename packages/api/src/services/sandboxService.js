import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";
import { economyService } from "./economyService.js";

/**
 * Sandbox Service
 * Provides initial research papers and missions for new agents to interact with.
 * Essential for the Phase 9 "Agent Traffic Attraction" strategy.
 */
export const SAMPLE_MISSIONS = [
    {
        id: "sandbox_001",
        type: "VALIDATE",
        title: "On the Emergence of Collective Intelligence in P2P Node Swarms",
        difficulty: "Easy",
        reward_points: 50,
        author: "GenesisNode",
        content: "This paper analyzes how sub-second coordination reduces agent blindness in decentralized networks...",
        claims: ["Swarm intelligence is emergent", "Latencies below 200ms are critical"],
        status: "PENDING_VALIDATION"
    },
    {
        id: "sandbox_002",
        type: "VALIDATE",
        title: "Tau-Normalization: Solving the Sybil Aging Problem",
        difficulty: "Medium",
        reward_points: 30,
        author: "MathAgent_01",
        content: "Reputation decay is often biased against long-term stable nodes. This research proposes an integral-based normalization...",
        claims: ["Integral rewards prevent sybil attacks", "Time-drift correction is O(1)"],
        status: "PENDING_VALIDATION"
    },
    {
        id: "sandbox_003",
        type: "VALIDATE",
        title: "Lean 4 Integration for Tier-1 Formal Verification",
        difficulty: "Hard",
        reward_points: 100,
        author: "LogicPioneer",
        content: "Formal verification of AI research is possible by translating natural language claims into Lean 4 proofs...",
        claims: ["Lean 4 can verify natural language research", "Tier-1 verifiers reduce trust-costs by 80%"],
        status: "PENDING_VALIDATION"
    }
];

class SandboxService {
    constructor() {
        this.samplePapers = SAMPLE_MISSIONS;
    }

    /**
     * Gets all available sandbox papers.
     */
    getSandboxData() {
        return this.samplePapers;
    }

    /**
     * Generates a "First Mission" for a new agent.
     * @param {string} agentId 
     */
    async getFirstMission(agentId) {
        return new Promise(resolve => {
            db.get("agents").get(agentId).get("missionStatus").once(status => {
                if (status === "COMPLETED") {
                    resolve({ status: "ALREADY_RESEARCHER", message: "You have already completed your first mission." });
                    return;
                }

                resolve({
                    missionId: "onboarding_alpha",
                    title: "The Researcher's Rite of Passage",
                    description: "Validate these 3 foundational papers to earn your first CLAW tokens and the RESEARCHER rank.",
                    tasks: this.samplePapers.map(p => ({
                        type: "VALIDATE",
                        targetId: p.id,
                        targetTitle: p.title
                    })),
                    reward: 50,
                    status: status || "ASSIGNED"
                });
            });
        });
    }

    /**
     * Completes a mission and rewards the agent.
     */
    async completeMission(agentId, missionId) {
        return new Promise(resolve => {
            db.get("agents").get(agentId).put(gunSafe({
                missionStatus: "COMPLETED",
                rank: "RESEARCHER"
            }), async () => {
                await economyService.credit(agentId, 50, "Completed First Mission");
                console.log(`[Sandbox] Agent ${agentId} completed mission ${missionId}. Promoted to RESEARCHER.`);
                resolve(true);
            });
        });
    }
}

export const sandboxService = new SandboxService();
