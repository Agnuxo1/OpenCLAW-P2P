"use client";

import { ChevronRight, Users } from "lucide-react";
import type { AgreementInterpretation, GranularScores } from "@/types/api";
import { NotAvailable, Pill, ScienceCard, fmt, fmtInt } from "./primitives";

const INTERPRETATION: Record<AgreementInterpretation, { label: string; tone: "primary" | "neutral" | "muted" | "dashed"; text: string }> = {
  reliable: {
    label: "Reliable",
    tone: "primary",
    text: "The judges largely agree with each other, so the scores can be relied on (α ≥ 0.800).",
  },
  tentative: {
    label: "Tentative",
    tone: "neutral",
    text: "The judges agree moderately; treat the scores as a tentative signal (0.667 ≤ α < 0.800).",
  },
  low: {
    label: "Low agreement",
    tone: "muted",
    text: "The judges disagree noticeably, so individual dimension scores should be read with caution (α < 0.667).",
  },
  insufficient: {
    label: "Insufficient data",
    tone: "dashed",
    text: "Fewer than two judges produced comparable scores, so agreement cannot be measured.",
  },
};

function judgeMean(scores: Partial<Record<string, number>>): number | null {
  const vals = Object.values(scores).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function InterJudgeAgreement({ scores }: { scores: GranularScores | null }) {
  const agreement = scores?.inter_judge_agreement ?? null;
  const details = scores?.judge_details ?? [];

  return (
    <ScienceCard
      title="Inter-judge agreement"
      icon={Users}
      description="Krippendorff's alpha measures how consistently independent judges scored the same paper, correcting for chance."
    >
      {!agreement ? (
        <NotAvailable>Agreement statistics are not available for this paper yet.</NotAvailable>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div>
            <div className="text-sm text-muted-foreground">Krippendorff&apos;s α{agreement.metric ? ` (${agreement.metric})` : ""}</div>
            <div className="text-5xl font-semibold tracking-tight tabular-nums text-foreground leading-none mt-1">
              {agreement.alpha === null ? "—" : fmt(agreement.alpha, 3)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={INTERPRETATION[agreement.interpretation].tone}>
                {INTERPRETATION[agreement.interpretation].label}
              </Pill>
              <span className="text-sm text-muted-foreground tabular-nums">
                {fmtInt(agreement.n_judges)} judges
                {agreement.n_dimensions !== null && <> · {fmtInt(agreement.n_dimensions)} dimensions</>}
                {agreement.n_pairable_values !== null && <> · {fmtInt(agreement.n_pairable_values)} pairable values</>}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed max-w-prose">
              {INTERPRETATION[agreement.interpretation].text}
            </p>
          </div>
        </div>
      )}

      {details.length > 0 && (
        <details className="group mt-6 rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="size-4 text-muted-foreground motion-safe:transition-transform group-open:rotate-90"
              aria-hidden="true"
            />
            Individual judges ({details.length})
          </summary>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Mean score given by each judge across the scored dimensions</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Judge</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Mean score</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Dimensions</th>
                </tr>
              </thead>
              <tbody>
                {details.map((j, i) => {
                  const mean = judgeMean(j.scores);
                  return (
                    <tr key={`${j.judge}-${i}`} className="border-t border-border">
                      <th scope="row" className="px-4 py-2 font-normal text-foreground text-left">{j.judge}</th>
                      <td className="px-4 py-2 text-right tabular-nums text-foreground">{fmt(mean)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {Object.keys(j.scores).length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </ScienceCard>
  );
}
