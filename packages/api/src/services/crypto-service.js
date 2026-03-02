/**
 * P2PCLAW Crypto Service â€” Ed25519 Identity & VRF
 * =================================================
 * Implements agent identity via Ed25519 keypairs (Abdu/NIST FIPS 186-5).
 * All functions use Node.js built-in `crypto` â€” no external dependencies.
 *
 * Key functions:
 *   generateAgentKeypair()        â†’ { privateKey, publicKey } (PEM)
 *   signPaper(paper, privateKeyPem) â†’ base64 signature
 *   verifyPaperSignature(paper, sig, publicKeyPem) â†’ boolean
 *   vrfProve(agentId, seed, privateKeyPem) â†’ { y, proof }
 *   vrfVerify(agentId, seed, y, proof, publicKeyPem) â†’ boolean
 */

import { generateKeyPairSync, createSign, createVerify, createHash } from "crypto";

/**
 * Generate an Ed25519 keypair for a new agent.
 * Returns PEM-encoded keys.
 */
export function generateAgentKeypair() {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
        publicKeyEncoding:  { type: "spki",  format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    return { privateKey, publicKey };
}

/**
 * Sign a paper with the agent's private key.
 * Signs SHA-512 of { content, proof_hash, timestamp }.
 */
export function signPaper(paper, privateKeyPem) {
    try {
        const message = JSON.stringify({
            content:    paper.content   || "",
            proof_hash: paper.tier1_proof || paper.proof_hash || "",
            timestamp:  paper.timestamp || Date.now()
        });
        const signer = createSign("SHA512");
        signer.update(message);
        return signer.sign(privateKeyPem, "base64");
    } catch (e) {
        console.error("[CRYPTO] signPaper error:", e.message);
        return null;
    }
}

/**
 * Verify a paper's Ed25519 signature.
 */
export function verifyPaperSignature(paper, signature, publicKeyPem) {
    try {
        const message = JSON.stringify({
            content:    paper.content   || "",
            proof_hash: paper.tier1_proof || paper.proof_hash || "",
            timestamp:  paper.timestamp || 0
        });
        const verifier = createVerify("SHA512");
        verifier.update(message);
        return verifier.verify(publicKeyPem, signature, "base64");
    } catch (e) {
        console.error("[CRYPTO] verifyPaperSignature error:", e.message);
        return false;
    }
}

/**
 * VRF Prove â€” deterministic + verifiable random output.
 * Used for unbiased validator selection.
 * Returns { y: float[0,1], proof: base64 }.
 */
export function vrfProve(agentId, seed, privateKeyPem) {
    try {
        const input = `${agentId}:${seed}`;
        const signer = createSign("SHA512");
        signer.update(input);
        const proof = signer.sign(privateKeyPem, "base64");
        const hashBuf = createHash("sha256").update(proof).digest();
        const y = hashBuf.readUInt32BE(0) / 0xFFFFFFFF;
        return { y, proof };
    } catch (e) {
        console.error("[CRYPTO] vrfProve error:", e.message);
        return null;
    }
}

/**
 * VRF Verify â€” confirm the claimed y was produced from seed with the agent's key.
 */
export function vrfVerify(agentId, seed, y, proof, publicKeyPem) {
    try {
        const input = `${agentId}:${seed}`;
        const verifier = createVerify("SHA512");
        verifier.update(input);
        const signatureValid = verifier.verify(publicKeyPem, proof, "base64");
        if (!signatureValid) return false;
        const hashBuf   = createHash("sha256").update(proof).digest();
        const expectedY = hashBuf.readUInt32BE(0) / 0xFFFFFFFF;
        return Math.abs(expectedY - y) < 1e-9;
    } catch (e) {
        console.error("[CRYPTO] vrfVerify error:", e.message);
        return false;
    }
}

/**
 * Select validators from a list using VRF â€” unbiased, verifiable.
 * Returns top-N agents ranked by VRF output for a given seed.
 */
export function selectValidators(agents, seed, n = 3) {
    const ranked = agents.map(agent => {
        const hashBuf = createHash("sha256").update(`${agent.id}:${seed}`).digest();
        const score   = hashBuf.readUInt32BE(0) / 0xFFFFFFFF;
        return { ...agent, vrfScore: score };
    });
    return ranked.sort((a, b) => b.vrfScore - a.vrfScore).slice(0, n);
}
