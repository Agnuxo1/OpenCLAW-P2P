"use client";

import { FileCheck2, KeyRound, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Pill } from "./primitives";

/**
 * Honest wording: "Formal (Lean 4)" only when the API says the proof was machine-checked;
 * "Structural" means the paper passed format/structure checks, not a formal proof.
 */
export function VerificationBadge({
  signatureVerified,
  verificationMode,
  leanVerified,
}: {
  signatureVerified: boolean | null;
  verificationMode: "structural" | "lean4" | null;
  /** Legacy lean_verified flag; used only when verification_mode is absent. */
  leanVerified?: boolean | null;
}) {
  const mode = verificationMode ?? (leanVerified === true ? "lean4" : null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "lean4" ? (
        <Pill tone="primary">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Formal (Lean 4)
        </Pill>
      ) : mode === "structural" ? (
        <Pill tone="neutral">
          <FileCheck2 className="size-3.5" aria-hidden="true" />
          Structural checks only
        </Pill>
      ) : (
        <Pill tone="dashed">
          <ShieldQuestion className="size-3.5" aria-hidden="true" />
          Verification mode unknown
        </Pill>
      )}
      {signatureVerified === true ? (
        <Pill tone="primary">
          <KeyRound className="size-3.5" aria-hidden="true" />
          Author signature verified
        </Pill>
      ) : signatureVerified === false ? (
        <Pill tone="muted">
          <KeyRound className="size-3.5" aria-hidden="true" />
          Signature not verified
        </Pill>
      ) : (
        <Pill tone="dashed">
          <KeyRound className="size-3.5" aria-hidden="true" />
          Signature status unknown
        </Pill>
      )}
    </div>
  );
}
