"use client";

import { BarChart3 } from "lucide-react";
import { SCORE_DIMENSIONS, type GranularScores, type ScoreDimension } from "@/types/api";
import { NotAvailable, ScienceCard, fmt, fmtDate } from "./primitives";

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  abstract: "Abstract",
  introduction: "Introduction",
  methodology: "Methodology",
  results: "Results",
  discussion: "Discussion",
  conclusion: "Conclusion",
  references: "References",
  novelty: "Novelty",
  reproducibility: "Reproducibility",
  citation_quality: "Citation quality",
};

function clamp10(v: number) {
  return Math.max(0, Math.min(10, v));
}

export function GranularScoreBreakdown({ scores }: { scores: GranularScores | null }) {
  if (!scores) {
    return (
      <ScienceCard title="Score breakdown" icon={BarChart3}>
        <NotAvailable>No granular scores have been published for this paper yet.</NotAvailable>
      </ScienceCard>
    );
  }

  const judgeCount = scores.judge_count ?? (scores.judges.length || null);
  // Agreement needs at least two judges; the legacy consensus field reports 100% for a single judge.
  const multiJudge = judgeCount !== null && judgeCount >= 2;

  return (
    <ScienceCard
      title="Score breakdown"
      icon={BarChart3}
      description={
        <>
          Ten dimensions scored 0–10 by an independent LLM jury, then calibrated against quality signals.
          {scores.scored_at && <> Scored {fmtDate(scores.scored_at)}.</>}
        </>
      }
    >
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="md:w-48 shrink-0">
          <div className="text-sm text-muted-foreground">Overall</div>
          <div className="text-6xl font-semibold tracking-tight tabular-nums text-foreground leading-none mt-1">
            {fmt(scores.overall)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">out of 10</div>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Judges</dt>
              <dd className="tabular-nums text-foreground">{judgeCount ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Mean agreement</dt>
              <dd className="tabular-nums text-foreground">
                {!multiJudge ? "n/a" : scores.overall_consensus !== null ? `${Math.round(scores.overall_consensus * 100)}%` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <ul className="flex-1 space-y-3" aria-label="Scores per dimension">
          {SCORE_DIMENSIONS.map((d) => {
            const v = scores.dimensions[d];
            const c = scores.consensus[d];
            const label = DIMENSION_LABELS[d];
            return (
              <li key={d} className="grid grid-cols-[8.5rem_1fr_2.75rem] items-center gap-3 text-sm">
                <span className="text-foreground truncate" title={label}>{label}</span>
                {v === undefined ? (
                  <>
                    <span className="h-2 rounded-full bg-muted" aria-hidden="true" />
                    <span className="text-right text-muted-foreground tabular-nums">—</span>
                    <span className="sr-only">{label}: not scored</span>
                  </>
                ) : (
                  <>
                    <span className="flex flex-col gap-1">
                      <span
                        role="meter"
                        aria-label={`${label} score`}
                        aria-valuemin={0}
                        aria-valuemax={10}
                        aria-valuenow={clamp10(v)}
                        aria-valuetext={`${fmt(v)} out of 10`}
                        className="block h-2 rounded-full bg-muted overflow-hidden"
                      >
                        <span
                          className="block h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500"
                          style={{ width: `${clamp10(v) * 10}%` }}
                        />
                      </span>
                      {c !== undefined && multiJudge && (
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="block h-0.5 w-10 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                            <span
                              className="block h-full bg-muted-foreground/60"
                              style={{ width: `${Math.max(0, Math.min(1, c)) * 100}%` }}
                            />
                          </span>
                          <span className="tabular-nums">judges agree {Math.round(c * 100)}%</span>
                        </span>
                      )}
                    </span>
                    <span className="text-right font-medium tabular-nums text-foreground">{fmt(v)}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </ScienceCard>
  );
}
