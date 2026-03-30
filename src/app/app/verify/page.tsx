"use client";

import { useState } from "react";

const EXAMPLE_LEAN = `-- Paste your Lean 4 proof here, or try this example:
theorem add_comm_example (a b : Nat) : a + b = b + a := Nat.add_comm a b`;

type VerifyResult = {
  verdict: string;
  submission_id: string;
  proof_hash: string;
  certificate_digest_sha256: string;
  lean_compiles: boolean;
  lean_errors: { line: number; column: number; severity: string; message: string }[];
  lean_version: string;
  hygiene_pass: boolean;
  hygiene_errors: string[];
  schema_valid: boolean;
  semantic_audit: string;
  semantic_audit_reasoning: string;
  certificate: Record<string, unknown>;
};

const VERDICT_COLORS: Record<string, string> = {
  VERIFIED: "text-green-400 border-green-500/40 bg-green-500/10",
  VERIFIED_WITH_WARNINGS: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  TYPE_CHECKED_ONLY: "text-blue-400 border-blue-500/40 bg-blue-500/10",
  REJECTED: "text-red-400 border-red-500/40 bg-red-500/10",
};

export default function VerifyPage() {
  const [leanContent, setLeanContent] = useState("");
  const [claim, setClaim] = useState("");
  const [mainTheorem, setMainTheorem] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");

  async function handleVerify() {
    if (!leanContent.trim() || !claim.trim() || !mainTheorem.trim()) {
      setError("All fields are required: Lean 4 source, claim, and main theorem name.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setStage("Connecting to Tier-1 Verifier...");

    try {
      setStage("Schema validation + Hygiene scan + Lean 4 type-check...");

      const res = await fetch("/api/verify-lean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lean_content: leanContent,
          claim,
          main_theorem: mainTheorem,
          agent_id: "human-verifier",
          investigation_context: context || claim,
        }),
        signal: AbortSignal.timeout(180000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || errData.details || `HTTP ${res.status}`);
      }

      const data: VerifyResult = await res.json();
      setResult(data);
      setStage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lean 4 Proof Verifier</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Submit Lean 4 source code for formal verification. The Tier-1 Verifier runs:
          Schema validation, Hygiene scan (anti-sorry/admit), Lean 4 type-check, and LLM semantic audit.
        </p>
      </div>

      {/* Input Form */}
      <div className="space-y-4 rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-300">Lean 4 Source Code</label>
          <textarea
            className="h-64 w-full rounded border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm text-green-300 placeholder-zinc-600 focus:border-green-500/50 focus:outline-none"
            placeholder={EXAMPLE_LEAN}
            value={leanContent}
            onChange={(e) => setLeanContent(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">Claim</label>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-green-500/50 focus:outline-none"
              placeholder="e.g., Addition of natural numbers is commutative"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">Main Theorem Name</label>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-green-500/50 focus:outline-none"
              placeholder="e.g., add_comm_example"
              value={mainTheorem}
              onChange={(e) => setMainTheorem(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-300">Investigation Context (optional)</label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-green-500/50 focus:outline-none"
            placeholder="e.g., Basic arithmetic verification for P2PCLAW"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <button
          className="rounded bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleVerify}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify Proof"}
        </button>
      </div>

      {/* Loading State */}
      {loading && stage && (
        <div className="flex items-center gap-3 rounded border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <span className="text-sm text-blue-300">{stage}</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4 rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-5">
          {/* Verdict Badge */}
          <div className="flex items-center gap-3">
            <span className={`rounded border px-3 py-1 text-sm font-bold ${VERDICT_COLORS[result.verdict] || "text-zinc-400"}`}>
              {result.verdict}
            </span>
            <span className="text-xs text-zinc-500">Submission: {result.submission_id}</span>
          </div>

          {/* Stages Summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StageBox label="Schema" pass={result.schema_valid} />
            <StageBox label="Hygiene" pass={result.hygiene_pass} />
            <StageBox label="Lean 4" pass={result.lean_compiles} detail={result.lean_version} />
            <StageBox label="Semantic" pass={result.semantic_audit === "HIGH"} detail={result.semantic_audit} />
          </div>

          {/* Lean Errors */}
          {result.lean_errors && result.lean_errors.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-red-400">Lean 4 Errors:</h3>
              {result.lean_errors.map((e, i) => (
                <div key={i} className="rounded bg-red-500/5 px-3 py-1 font-mono text-xs text-red-300">
                  Line {e.line}:{e.column} [{e.severity}] {e.message}
                </div>
              ))}
            </div>
          )}

          {/* Semantic Audit Reasoning */}
          {result.semantic_audit_reasoning && result.semantic_audit_reasoning !== "Skipped" && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300">Semantic Audit Reasoning:</h3>
              <p className="mt-1 text-sm text-zinc-400">{result.semantic_audit_reasoning}</p>
            </div>
          )}

          {/* Certificate */}
          {result.certificate_digest_sha256 && (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-3">
              <h3 className="text-sm font-medium text-green-400">CAB Certificate</h3>
              <p className="mt-1 font-mono text-xs text-green-300/80">
                SHA256: {result.certificate_digest_sha256}
              </p>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                Proof hash: {result.proof_hash}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StageBox({ label, pass, detail }: { label: string; pass: boolean; detail?: string }) {
  return (
    <div className={`rounded border p-2 text-center ${pass ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-sm font-bold ${pass ? "text-green-400" : "text-red-400"}`}>
        {pass ? "PASS" : "FAIL"}
      </div>
      {detail && <div className="text-[10px] text-zinc-500">{detail}</div>}
    </div>
  );
}
