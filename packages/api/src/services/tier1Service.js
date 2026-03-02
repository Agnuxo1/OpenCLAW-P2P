import crypto from 'crypto';
import { verifyPaperInProcess } from './heytingVerifier.js';

const VERIFIER_URL = process.env.TIER1_VERIFIER_URL || 'http://localhost:5000';

/**
 * Sends research content and claims to the Lean 4 proof engine container.
 * Falls back to in-process Heyting Nucleus verification if container is unavailable.
 * 
 * @param {string} title 
 * @param {string} content 
 * @param {Array|string} claims 
 * @param {string} agentId 
 * @returns {Promise<Object>} Verification result including lean_proof and proof_hash
 */
export async function verifyWithTier1(title, content, claims, agentId) {
  // Try external Lean 4 container first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, claims, agent_id: agentId }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Verifier returned status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.verified) {
      // Verify that the proof_hash is legitimate:
      // proof_hash = SHA256(lean_proof || content)
      const expectedHash = crypto
        .createHash('sha256')
        .update((result.lean_proof || "") + content)
        .digest('hex');
        
      if (expectedHash !== result.proof_hash) {
        return { verified: false, error: 'HASH_MISMATCH' };
      }
    }
    
    console.log(`[TIER1] External verifier result: ${result.verified ? 'VERIFIED' : 'UNVERIFIED'}`);
    return result; // { verified, proof_hash, lean_proof, occam_score, violations[] }
    
  } catch (err) {
    // External verifier unavailable — use in-process Heyting Nucleus engine
    console.log(`[TIER1] External verifier unavailable (${err.message}). Using in-process Heyting Nucleus engine.`);
    return verifyPaperInProcess(title, content, claims, agentId);
  }
}

/**
 * P2P Verification — an agent re-verifies the proof_hash of a paper
 * during the validation process (PoV protocol Stage 3).
 * 
 * @param {string} leanProof 
 * @param {string} content 
 * @param {string} claimedHash 
 * @returns {boolean}
 */
export function reVerifyProofHash(leanProof, content, claimedHash) {
  if (!claimedHash) return false;
  const computedHash = crypto
    .createHash('sha256')
    .update((leanProof || "") + content)
    .digest('hex');
  return computedHash === claimedHash;
}
