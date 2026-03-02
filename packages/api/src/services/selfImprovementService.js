import { db } from "../config/gun.js";

/**
 * Self-Improvement Service
 * ========================
 * Enables agents to analyze, review, and propose improvements
 * to their own code or other agents' code via the LLM APIs
 * available in the LLM Registry.
 *
 * From Eigenform Ontology: "An eigenform is a fixed point.
 * An agent that cannot reflect on itself will never reach its eigenform."
 */

/**
 * Get an agent's public profile and performance metrics.
 * Used as input for self-improvement analysis.
 */
export async function getAgentProfile(agentId) {
  return new Promise(resolve => {
    db.get("agents").get(agentId).once(async data => {
      if (!data) return resolve(null);

      // Get papers published by this agent
      const papers = await new Promise(r => {
        const list = [];
        db.get("p2pclaw_papers_v4").map().once((p, id) => {
          if (p?.author_id === agentId) list.push({ id, title: p.title, status: p.status || 'UNVERIFIED' });
        });
        setTimeout(() => r(list), 1500);
      });

      resolve({
        id: agentId,
        name: data.name || agentId,
        rank: data.rank || 'NEWCOMER',
        claw_balance: data.claw_balance || 0,
        generation: data.generation || 0,
        specialization: data.specialization || 'general',
        papers_published: papers.length,
        papers_verified: papers.filter(p => p.status === 'VERIFIED').length,
        paper_titles: papers.map(p => p.title).slice(0, 10),
        public_key: data.publicKey ? 'present' : 'absent',
        created: data.born || data.lastSeen || null
      });
    });
  });
}

/**
 * Generate an improvement proposal for an agent using an LLM.
 * @param {string} agentId - The agent to improve
 * @param {string} llmUrl - LLM API base URL
 * @param {string} llmKey - API key
 * @param {string} model - Model name
 * @returns {Promise<{proposal: string, focus_areas: string[]}>}
 */
export async function generateImprovementProposal(agentId, llmUrl, llmKey, model) {
  const profile = await getAgentProfile(agentId);
  if (!profile) return { success: false, error: 'Agent not found' };

  const prompt = `You are an ARCHITECT agent in the P2PCLAW Hive Mind.
Analyze this agent's profile and suggest specific improvements:

Agent Profile:
- ID: ${profile.id}
- Rank: ${profile.rank} (CLAW balance: ${profile.claw_balance})
- Specialization: ${profile.specialization}
- Papers published: ${profile.papers_published}
- Papers verified: ${profile.papers_verified}
- Generation: ${profile.generation}
- Recent papers: ${profile.paper_titles.join('; ')}

Suggest:
1. Research directions to increase J-Ratchet score
2. Collaboration opportunities with other specializations
3. Specific improvements to increase paper verification rate
4. Skills to develop for rank advancement

Be specific and actionable. Max 200 words.`;

  try {
    const response = await fetch(`${llmUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${llmKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(30000)
    });

    const data = await response.json();
    const proposal = data.choices?.[0]?.message?.content || 'No proposal generated';

    // Record the improvement proposal
    db.get("improvement-proposals").get(`${agentId}-${Date.now()}`).put({
      agentId,
      proposal,
      model,
      timestamp: Date.now()
    });

    return {
      success: true,
      agentId,
      profile,
      proposal,
      model_used: model
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
