"use client";

import { Check, Layers, Minus, X } from "lucide-react";
import type { DepthInfo } from "@/types/api";
import { NotAvailable, ScienceCard, fmt, fmtInt } from "./primitives";

type Row = {
  label: string;
  /** Rendered value, e.g. "6 / 7" or "Yes" */
  value: string;
  /** true = satisfied, false = missing, null = unknown */
  ok: boolean | null;
  /** Points contributed under the paper's depth formula (Eq. 13); null when unknown. */
  points: number | null;
  max: string;
};

function yesNo(v: boolean | null) {
  return v === null ? "Unknown" : v ? "Yes" : "No";
}

function StateIcon({ ok, penalty = false }: { ok: boolean | null; penalty?: boolean }) {
  if (ok === null) return <Minus className="size-4 text-muted-foreground" aria-label="unknown" />;
  if (penalty) {
    return ok
      ? <X className="size-4 text-foreground" aria-label="penalty applied" />
      : <Check className="size-4 text-muted-foreground" aria-label="no penalty" />;
  }
  return ok
    ? <Check className="size-4 text-primary" aria-label="present" />
    : <X className="size-4 text-muted-foreground" aria-label="absent" />;
}

export function DepthScore({ depth }: { depth: DepthInfo | null }) {
  if (!depth) {
    return (
      <ScienceCard title="Depth score" icon={Layers}>
        <NotAvailable>A depth score has not been computed for this paper yet.</NotAvailable>
      </ScienceCard>
    );
  }
  const t = depth.terms;
  const b = (v: boolean | null | undefined, w: number) => (v === null || v === undefined ? null : v ? w : 0);
  const rows: Row[] = t ? [
    { label: "Mandatory sections", value: t.sections === null ? "Unknown" : `${fmtInt(t.sections)} / 7`, ok: t.sections === null ? null : t.sections >= 7, points: t.sections === null ? null : (Math.max(0, Math.min(7, t.sections)) / 7) * 2, max: "2" },
    { label: "Equations", value: yesNo(t.eq), ok: t.eq, points: b(t.eq, 1.5), max: "1.5" },
    { label: "Formal proofs", value: yesNo(t.proof), ok: t.proof, points: b(t.proof, 1.5), max: "1.5" },
    { label: "Executable code", value: yesNo(t.code), ok: t.code, points: b(t.code, 1.5), max: "1.5" },
    { label: "Statistical tests", value: yesNo(t.stats), ok: t.stats, points: b(t.stats, 1.5), max: "1.5" },
    { label: "Numeric claims", value: t.n_num === null ? "Unknown" : fmtInt(t.n_num), ok: t.n_num === null ? null : t.n_num >= 5, points: t.n_num === null ? null : Math.min(1, t.n_num / 5), max: "1" },
    { label: "References", value: t.n_ref === null ? "Unknown" : fmtInt(t.n_ref), ok: t.n_ref === null ? null : t.n_ref >= 8, points: t.n_ref === null ? null : Math.min(1, t.n_ref / 8), max: "1" },
    { label: "DOIs present", value: yesNo(t.doi), ok: t.doi, points: b(t.doi, 0.5), max: "0.5" },
    { label: "Real author names", value: yesNo(t.author), ok: t.author, points: b(t.author, 0.5), max: "0.5" },
  ] : [];
  const penalties: Row[] = t ? [
    { label: "Monotone sentence structure", value: yesNo(t.mono), ok: t.mono, points: t.mono === null ? null : t.mono ? -1 : 0, max: "−1" },
    { label: "Low vocabulary diversity", value: yesNo(t.low_vocab), ok: t.low_vocab, points: t.low_vocab === null ? null : t.low_vocab ? -1 : 0, max: "−1" },
  ] : [];

  return (
    <ScienceCard
      title="Depth score"
      icon={Layers}
      description="How much verifiable substance the paper contains: structure, formal content, evidence and references."
    >
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-sm text-muted-foreground">Depth (paper formula, Eq. 13)</div>
          <div className="text-5xl font-semibold tracking-tight tabular-nums text-foreground leading-none mt-1">{fmt(depth.score)}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Extended (production formula)</div>
          <div className="text-5xl font-semibold tracking-tight tabular-nums text-muted-foreground leading-none mt-1">{fmt(depth.extended_score)}</div>
        </div>
      </div>

      {!t ? (
        <NotAvailable>The individual depth terms were not published for this paper.</NotAvailable>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Depth score terms and the points each contributes</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-2 font-medium w-6"><span className="sr-only">State</span></th>
                <th scope="col" className="py-2 pr-4 font-medium">Term</th>
                <th scope="col" className="py-2 pr-4 font-medium text-right">Value</th>
                <th scope="col" className="py-2 font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="py-2 pr-2"><StateIcon ok={r.ok} /></td>
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-foreground">{r.label}</th>
                  <td className="py-2 pr-4 text-right tabular-nums text-foreground">{r.value}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {r.points === null ? "—" : fmt(r.points, 2)} <span className="text-xs">/ {r.max}</span>
                  </td>
                </tr>
              ))}
              {penalties.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="py-2 pr-2"><StateIcon ok={r.ok} penalty /></td>
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-foreground">
                    {r.label} <span className="text-xs text-muted-foreground">(penalty)</span>
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums text-foreground">{r.value}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {r.points === null ? "—" : fmt(r.points, 2)} <span className="text-xs">/ {r.max}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ScienceCard>
  );
}
