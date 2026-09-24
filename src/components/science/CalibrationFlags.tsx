"use client";

import { AlertTriangle, ChevronRight, Flag, Info, ShieldAlert } from "lucide-react";
import type { CalibrationInfo, FlagSeverity } from "@/types/api";
import { NotAvailable, Pill, ScienceCard, fmtInt, humanize } from "./primitives";

const SEVERITY_ORDER: Record<FlagSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function SeverityPill({ severity }: { severity: FlagSeverity }) {
  const tone = severity === "critical" ? "destructive" : severity === "high" ? "strong" : severity === "medium" ? "neutral" : "muted";
  return (
    <Pill tone={tone}>
      {severity === "critical" && <AlertTriangle className="size-3" aria-hidden="true" />}
      {humanize(severity)}
    </Pill>
  );
}

/** Red flags such as "impossible_WS_path_length_3.2" become readable sentences. */
function describeFlag(flag: string): string {
  return humanize(flag.replace(/_(\d+(\.\d+)?)$/, " ($1)"));
}

export function CalibrationFlags({ calibration }: { calibration: CalibrationInfo | null }) {
  if (!calibration) {
    return (
      <ScienceCard title="Calibration and red flags" icon={ShieldAlert}>
        <NotAvailable>Calibration signals were not recorded for this paper.</NotAvailable>
      </ScienceCard>
    );
  }

  const deception = [...calibration.deception_matches].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  // Deception matches are mirrored into red_flags as "deception:<id>:<severity>" — show them once.
  const otherFlags = calibration.red_flags.filter((f) => !f.startsWith("deception:"));
  const adjustments = Object.entries(calibration.adjustments);
  const clean = deception.length === 0 && otherFlags.length === 0;

  return (
    <ScienceCard
      title="Calibration and red flags"
      icon={ShieldAlert}
      description={
        <>
          Automatic detectors that look for padding, fabricated evidence and other deception patterns before scores are finalised.
          {calibration.field && <> Detected field: <span className="text-foreground">{humanize(calibration.field)}</span>.</>}
        </>
      }
    >
      {clean ? (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Info className="size-4 text-muted-foreground" aria-hidden="true" />
          No red flags or deception patterns were detected.
        </p>
      ) : (
        <div className="space-y-6">
          {deception.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Deception detectors ({deception.length})</h4>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {deception.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-foreground">{d.name}</span>
                    <SeverityPill severity={d.severity} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {otherFlags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Red flags ({otherFlags.length})</h4>
              <ul className="space-y-1.5">
                {otherFlags.map((f, i) => (
                  <li key={`${f}-${i}`} className="flex items-start gap-2 text-sm text-foreground">
                    <Flag className="size-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    {describeFlag(f)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {calibration.sections_missing.length > 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Missing sections: <span className="text-foreground">{calibration.sections_missing.map(humanize).join(", ")}</span>
        </p>
      )}

      {calibration.false_positive_corrected && (
        <p className="mt-3 text-sm text-muted-foreground">
          Corrected false positive: {calibration.false_positive_corrected}
        </p>
      )}

      {adjustments.length > 0 && (
        <details className="group mt-6 rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 text-muted-foreground motion-safe:transition-transform group-open:rotate-90" aria-hidden="true" />
            Score adjustments ({fmtInt(calibration.adjustment_count ?? adjustments.length)} dimensions)
          </summary>
          <dl className="border-t border-border px-4 py-3 space-y-3 text-sm">
            {adjustments.map(([field, list]) => (
              <div key={field}>
                <dt className="font-medium text-foreground">{humanize(field)}</dt>
                <dd>
                  <ul className="mt-1 space-y-0.5">
                    {list.map((a, i) => (
                      <li key={i} className="font-mono text-xs text-muted-foreground break-words">{a}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </ScienceCard>
  );
}
