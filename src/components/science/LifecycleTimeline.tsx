"use client";

import { Check, GitCommitHorizontal } from "lucide-react";
import { LIFECYCLE_STAGES, type LifecycleStage } from "@/types/api";
import { NotAvailable, ScienceCard } from "./primitives";
import { cn } from "@/lib/utils";

const STAGE_INFO: Record<LifecycleStage, { label: string; text: string }> = {
  MEMPOOL: { label: "Mempool", text: "Submitted, awaiting peer validation" },
  VERIFIED: { label: "Verified", text: "Passed automated verification" },
  PROMOTED: { label: "Promoted", text: "Validated by at least two peers" },
  PODIUM: { label: "Podium", text: "Among the current top papers" },
  CANONICAL: { label: "Canonical", text: "Promoted, score ≥ 8.5 and pinned to IPFS" },
};

/**
 * Contract rule (CONTRACT.md §1), used only when the API does not send lifecycle_stage:
 * MEMPOOL → VERIFIED → PROMOTED (status PROMOTED or ≥ 2 validations) → PODIUM (on podium)
 * → CANONICAL (PROMOTED and overall ≥ 8.5 and ipfs_cid present).
 */
export function deriveLifecycleStage(input: {
  status: string | null | undefined;
  networkValidations: number | null | undefined;
  overall: number | null | undefined;
  ipfsCid: string | null | undefined;
  onPodium: boolean | null | undefined;
}): LifecycleStage | null {
  const status = String(input.status ?? "").toUpperCase();
  const promoted = status === "PROMOTED" || (input.networkValidations ?? 0) >= 2;
  if (promoted && (input.overall ?? 0) >= 8.5 && !!input.ipfsCid) return "CANONICAL";
  if (input.onPodium === true) return "PODIUM";
  if (promoted) return "PROMOTED";
  if (status === "VERIFIED") return "VERIFIED";
  if (status === "MEMPOOL" || status === "PENDING") return "MEMPOOL";
  return null;
}

export function LifecycleTimeline({
  stage,
  derived = false,
}: {
  stage: LifecycleStage | null;
  /** true when the stage was computed in the browser rather than reported by the API */
  derived?: boolean;
}) {
  const currentIndex = stage ? LIFECYCLE_STAGES.indexOf(stage) : -1;
  return (
    <ScienceCard
      title="Lifecycle"
      icon={GitCommitHorizontal}
      description={
        derived && stage
          ? "Stage derived in your browser from status, validations, podium and IPFS data using the protocol rule."
          : "Every paper moves from the mempool towards canonical status as evidence accumulates."
      }
    >
      {currentIndex < 0 ? (
        <NotAvailable>The lifecycle stage of this paper is not known yet.</NotAvailable>
      ) : (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-0" aria-label="Paper lifecycle">
          {LIFECYCLE_STAGES.map((s, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <li
                key={s}
                aria-current={current ? "step" : undefined}
                className="relative flex items-start gap-3 sm:flex-col sm:items-center sm:text-center sm:px-2"
              >
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "hidden sm:block absolute top-4 right-1/2 w-full h-px -translate-y-1/2",
                      i <= currentIndex ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    current && "border-primary bg-primary text-primary-foreground",
                    done && "border-primary bg-background text-primary",
                    !current && !done && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                <span className="sm:mt-2">
                  <span className={cn("block text-sm", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {STAGE_INFO[s].label}
                    {current && <span className="sr-only"> (current stage)</span>}
                    {done && <span className="sr-only"> (completed)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{STAGE_INFO[s].text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </ScienceCard>
  );
}
