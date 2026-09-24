"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { PaperScience } from "@/types/api";
import { CalibrationFlags } from "./CalibrationFlags";
import { DepthScore } from "./DepthScore";
import { GranularScoreBreakdown } from "./GranularScoreBreakdown";
import { InterJudgeAgreement } from "./InterJudgeAgreement";
import { LifecycleTimeline, deriveLifecycleStage } from "./LifecycleTimeline";
import { PersistenceTiers } from "./PersistenceTiers";
import { NotAvailable } from "./primitives";
import { ReferenceVerification } from "./ReferenceVerification";
import { VerificationBadge } from "./VerificationBadge";

/** The full "Evaluation" view of one paper. Tolerates every v8 field being absent. */
export function PaperEvaluation({
  science,
  isLoading,
  fallbackStatus,
  fallbackValidations,
  fallbackIpfsCid,
  fallbackLeanVerified,
  podiumIds,
}: {
  science: PaperScience | null | undefined;
  isLoading: boolean;
  /** Normalised status from the list view, used when the raw record could not be fetched. */
  fallbackStatus?: string;
  fallbackValidations?: number;
  fallbackIpfsCid?: string;
  fallbackLeanVerified?: boolean;
  /** null = podium unknown (the PODIUM stage is then never claimed) */
  podiumIds: string[] | null | undefined;
}) {
  if (isLoading && !science) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading evaluation">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  const g = science?.granular ?? null;
  const reported = science?.lifecycle_stage ?? null;
  const derived = reported
    ? null
    : deriveLifecycleStage({
        status: science?.raw_status ?? fallbackStatus,
        networkValidations: science?.network_validations ?? fallbackValidations,
        overall: g?.overall,
        ipfsCid: science?.ipfs_cid ?? fallbackIpfsCid,
        onPodium: podiumIds ? podiumIds.includes(science?.id ?? "") : null,
      });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <h3 className="text-lg font-semibold tracking-tight text-foreground mb-3">Verification</h3>
        <VerificationBadge
          signatureVerified={science?.signature_verified ?? null}
          verificationMode={science?.verification_mode ?? null}
          leanVerified={science?.lean_verified ?? fallbackLeanVerified ?? null}
        />
        {science?.tribunal_grade && (
          <p className="mt-3 text-sm text-muted-foreground">
            Author Tribunal grade: <span className="text-foreground">{science.tribunal_grade}</span>
            {science.tribunal_iq && <> · IQ band {science.tribunal_iq}</>}
          </p>
        )}
        {!science && (
          <NotAvailable className="mt-4">
            The detailed evaluation record could not be loaded. It may still be syncing across the network.
          </NotAvailable>
        )}
      </div>

      <LifecycleTimeline stage={reported ?? derived} derived={!reported} />
      <GranularScoreBreakdown scores={g} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <InterJudgeAgreement scores={g} />
        <DepthScore depth={g?.depth ?? null} />
      </div>
      <CalibrationFlags calibration={g?.calibration ?? null} />
      <ReferenceVerification verification={g?.reference_verification ?? null} />
      <PersistenceTiers persistence={science?.persistence ?? null} />
    </div>
  );
}
