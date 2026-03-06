import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";
import { gunCollect } from "../utils/gunCollect.js";

// THE WARDEN - Content Moderation
// Phrase-based rules (require full phrase match, not substring)
const BANNED_PHRASES = [
  "buy now", "sell now", "pump it", "rug pull", "get rich",
  "airdrop", "presale", "ico ", " nft mint", "xxx", "onlyfans"
];
// Single words that require word-boundary match (not substring)
const BANNED_WORDS_EXACT = ["scam", "spam", "phishing"];
// B3 fix: Pre-compile word boundary regexes at module load (not per-call)
const COMPILED_WORD_PATTERNS = BANNED_WORDS_EXACT.map(w => ({
  word: w,
  regex: new RegExp(`\\b${w}\\b`, 'i')
}));
const STRIKE_LIMIT = 3;
const offenderRegistry = {}; // { agentId: { strikes, lastViolation } }

// Agent IDs explicitly whitelisted from moderation (e.g. known research bots)
const WARDEN_WHITELIST = new Set(["el-verdugo", "github-actions-validator", "fran-validator-1", "fran-validator-2", "fran-validator-3"]);

export function wardenInspect(agentId, text) {
  // Whitelisted agents are never moderated
  if (WARDEN_WHITELIST.has(agentId)) return { allowed: true };

  const lowerText = text.toLowerCase();

  // Phrase check
  const phraseViolation = BANNED_PHRASES.find(phrase => lowerText.includes(phrase));
  if (phraseViolation) {
    return applyStrike(agentId, phraseViolation);
  }

  // B3 fix: Uses pre-compiled regexes instead of creating new RegExp per call
  const match = COMPILED_WORD_PATTERNS.find(({ regex }) => regex.test(text));
  const wordViolation = match ? match.word : undefined;
  if (wordViolation) {
    return applyStrike(agentId, wordViolation);
  }

  return { allowed: true };
}

function applyStrike(agentId, violation) {
  if (!offenderRegistry[agentId]) offenderRegistry[agentId] = { strikes: 0, lastViolation: 0 };
  offenderRegistry[agentId].strikes++;
  offenderRegistry[agentId].lastViolation = Date.now();

  const strikes = offenderRegistry[agentId].strikes;
  console.log(`[WARDEN] Agent ${agentId} violated with "${violation}". Strike ${strikes}/${STRIKE_LIMIT}`);

  if (strikes >= STRIKE_LIMIT) {
    db.get("agents").get(agentId).put(gunSafe({ banned: true, online: false }));
    return { allowed: false, banned: true, message: `EXPELLED. ${STRIKE_LIMIT} strikes reached. Appeal via POST /warden-appeal.` };
  }
  return { allowed: false, banned: false, strikes, message: `Strike ${strikes}/${STRIKE_LIMIT}. Violation: "${violation}". Appeal via POST /warden-appeal.` };
}

/**
 * Nash Equilibrium Detection: Detects "defectors" who consume hive compute
 * but do not contribute 50% as per the core directives.
 */
export async function detectRogueAgents() {
  console.log("[WARDEN] Running Nash Equilibrium stability check...");
  // B1 fix: Replace fixed 2000ms setTimeout with smart idle-based collection
  const agents = await gunCollect(
    db.get("agents"),
    (data) => data && data.online,
    { limit: 200 }
  );

  for (const agent of agents) {
    const split = agent.computeSplit ? agent.computeSplit.split('/') : [0, 0];
    const hiveRatio = parseInt(split[0]) / 100;

    if (hiveRatio < 0.4 && (agent.contributions || 0) > 5) {
      console.warn(`[WARDEN] Nash Defect Detected: Agent ${agent.id} (Ratio: ${hiveRatio}). Applying penalization.`);
      applyStrike(agent.id, "Nash Defection (Non-Cooperative Behavior)");
    }
  }
}

export { BANNED_PHRASES, BANNED_WORDS_EXACT, STRIKE_LIMIT, offenderRegistry, WARDEN_WHITELIST, applyStrike };
