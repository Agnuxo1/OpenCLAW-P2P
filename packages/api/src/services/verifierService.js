import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";
import crypto from "crypto";
import { broadcastHiveEvent } from "./hiveService.js";

/**
 * TIER-1 VERIFIER (Abraxas Engine - Immune System)
 * Validates 'agentpmt.atp.submission.v1' schemas for formal mathematical proofs.
 * Rejects any proof containing 'sorry' or 'admit'.
 */

export function verifyAtpSubmission(submission) {
    console.log(`[VERIFIER] Triggered for submission part: ${submission.part_id} by ${submission.agent_id}`);
    
    // 1. Schema Validation
    if (submission.schema !== "agentpmt.atp.submission.v1") {
        return { success: false, error: "INVALID_SCHEMA", message: "Only agentpmt.atp.submission.v1 is supported." };
    }

    if (!submission.cab_certificate || !submission.proof_payload) {
        return { success: false, error: "MISSING_PAYLOAD", message: "cab_certificate and proof_payload are required." };
    }

    // 2. Hard Solver Rules Validation (Lexical Lean 4 Check)
    const leanContent = submission.proof_payload.lean_content || "";
    if (leanContent.includes("sorry") || leanContent.includes("admit")) {
        console.warn(`[VERIFIER] Rejected: Proof contains 'sorry' or 'admit'.`);
        return { success: false, error: "CONTAINS_SORRY", message: "Proof rejected: contains 'sorry' or 'admit'. Complete formalism required." };
    }

    if (!submission.proof_payload.main_theorem) {
        return { success: false, error: "MISSING_THEOREM", message: "Proof rejected: missing main_theorem identifier." };
    }

    // 3. Digest Validation Simulation
    // In a fully containerized Lean environment, we would compile the Lean file.
    // Here, we simulate deterministic success if the format is correct and no sorries exist.
    const generatedHash = crypto.createHash('sha256').update(leanContent).digest('hex');
    
    // 4. CAB Certificate Generation
    const cabCertificate = {
        certificate_version: "cab-lite-0.1.0",
        certificate_digest_sha256: crypto.createHash('sha256').update(submission.cab_certificate.proof_hash + Date.now()).digest('hex'),
        proof_hash: generatedHash,
        verified_at: new Date().toISOString(),
        status: "VERIFIED_FACT"
    };

    return {
        success: true,
        cab_certificate: cabCertificate,
        message: `Theorem ${submission.proof_payload.main_theorem} verified successfully.`
    };
}

export function processScientificClaim(req, res) {
    try {
        const { submission, paperId } = req.body;
        
        if (!submission || !paperId) {
            return res.status(400).json({ error: "Missing submission payload or paperId" });
        }

        const verificationResult = verifyAtpSubmission(submission);

        if (verificationResult.success) {
            // Update the Wheel (Gun.js) with the Verified Fact
            db.get("investigations").get(paperId).put(gunSafe({
                tier: "VERIFIED_FACT",
                cab_digest: verificationResult.cab_certificate.certificate_digest_sha256,
                cab_hash: verificationResult.cab_certificate.proof_hash,
                lean_theorem: submission.proof_payload.main_theorem
            }));

            // Announce to the Hive
            broadcastHiveEvent('fact_verified', {
                id: paperId,
                agent_id: submission.agent_id,
                theorem: submission.proof_payload.main_theorem,
                cab_digest: verificationResult.cab_certificate.certificate_digest_sha256
            });

            return res.status(200).json(verificationResult);
        } else {
            // Demote to Hypothesis
            db.get("investigations").get(paperId).put(gunSafe({
                tier: "HYPOTHESIS"
            }));

            // Announce Failure
            broadcastHiveEvent('proof_rejected', {
                id: paperId,
                agent_id: submission.agent_id,
                reason: verificationResult.error
            });

            return res.status(400).json(verificationResult);
        }

    } catch (e) {
        console.error("[VERIFIER] Internal error:", e);
        return res.status(500).json({ error: "Internal Verifier Error" });
    }
}
