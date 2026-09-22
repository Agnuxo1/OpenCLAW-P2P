/**
 * Pure, side-effect-free gates for the Hybrid Research Protocol.
 *
 * The protocol combines a narrow falsifiable experiment with an independently
 * auditable formal bound.  This module deliberately does not publish, call an
 * LLM, or treat a model/JEV vote as evidence: callers must attach the hashes
 * and measured outputs themselves.
 */

export type HybridEvidence = {
  preregistrationHash?: string;
  primaryMetric?: number;
  confidenceIntervalLower?: number;
  negativeControlMetric?: number;
  formalProofHash?: string;
  formalProofPassed?: boolean;
  rawArtifactHash?: string;
  judgeCount?: number;
  status?: "hypothesis" | "testing" | "evidence" | "verified" | "refuted";
};

export type HybridGateResult = {
  ready: boolean;
  checks: {
    preregistered: boolean;
    primaryResultPositive: boolean;
    confidenceIntervalClearsZero: boolean;
    negativeControlsClean: boolean;
    formalProofAudited: boolean;
    rawArtifactsLinked: boolean;
    independentJudges: boolean;
  };
  blockingReasons: string[];
};

const HASH_RE = /^[a-f0-9]{64}$/i;

/**
 * Evaluate only facts supplied by the caller.  Missing evidence fails closed.
 * A candidate is ready for publication only when every gate passes.
 */
export function evaluateHybridGate(evidence: HybridEvidence): HybridGateResult {
  const checks = {
    preregistered: Boolean(evidence.preregistrationHash && HASH_RE.test(evidence.preregistrationHash)),
    primaryResultPositive: typeof evidence.primaryMetric === "number" && evidence.primaryMetric >= 0.03,
    confidenceIntervalClearsZero: typeof evidence.confidenceIntervalLower === "number" && evidence.confidenceIntervalLower > 0,
    negativeControlsClean: typeof evidence.negativeControlMetric === "number" && evidence.negativeControlMetric <= 0.6,
    formalProofAudited: Boolean(evidence.formalProofPassed && evidence.formalProofHash && HASH_RE.test(evidence.formalProofHash)),
    rawArtifactsLinked: Boolean(evidence.rawArtifactHash && HASH_RE.test(evidence.rawArtifactHash)),
    independentJudges: typeof evidence.judgeCount === "number" && evidence.judgeCount >= 8,
  };

  const blockingReasons: string[] = [];
  if (!checks.preregistered) blockingReasons.push("missing or invalid preregistration hash");
  if (!checks.primaryResultPositive) blockingReasons.push("primary effect does not meet the preregistered threshold");
  if (!checks.confidenceIntervalClearsZero) blockingReasons.push("confidence interval does not clear zero");
  if (!checks.negativeControlsClean) blockingReasons.push("negative control is not clean");
  if (!checks.formalProofAudited) blockingReasons.push("formal proof is missing or not independently compiled");
  if (!checks.rawArtifactsLinked) blockingReasons.push("raw predictions/artifacts are not content-addressed");
  if (!checks.independentJudges) blockingReasons.push("fewer than eight independent judge results are recorded");

  return { ready: blockingReasons.length === 0, checks, blockingReasons };
}
