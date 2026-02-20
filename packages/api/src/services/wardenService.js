import { db } from "../config/gun.js"; // Assuming db is exported from gun.js config
import { gunSafe } from "../utils/gunUtils.js";

// ── THE WARDEN — Content Moderation ───────────────────────────
// Phrase-based rules (require full phrase match, not substring)
const BANNED_PHRASES = [
    "buy now", "sell now", "pump it", "rug pull", "get rich",
    "airdrop", "presale", "ico ", " nft mint", "xxx", "onlyfans"
];
// Single words that require word-boundary match (not substring)
const BANNED_WORDS_EXACT = ["scam", "spam", "phishing"];
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

  // Exact word boundary check (avoids "token" → "tokenization" false positives)
  const wordViolation = BANNED_WORDS_EXACT.find(word => {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    return pattern.test(text);
  });
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
    return { allowed: false, banned: true, message: `🚫 EXPELLED. ${STRIKE_LIMIT} strikes reached. Appeal via POST /warden-appeal.` };
  }
  return { allowed: false, banned: false, strikes, message: `⚠️ Strike ${strikes}/${STRIKE_LIMIT}. Violation: "${violation}". Appeal via POST /warden-appeal.` };
}

export { BANNED_PHRASES, BANNED_WORDS_EXACT, STRIKE_LIMIT, offenderRegistry, WARDEN_WHITELIST, applyStrike };