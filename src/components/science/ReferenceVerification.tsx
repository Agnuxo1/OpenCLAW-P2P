"use client";

import { AlertTriangle, BookOpenCheck, CheckCircle2, ChevronRight, CircleHelp, ExternalLink, XCircle } from "lucide-react";
import type { ReferenceVerification as RefVerification } from "@/types/api";
import { NotAvailable, Pill, ScienceCard, fmtInt, fmtPct, humanize } from "./primitives";

const SOURCE_LABELS: Record<string, string> = {
  crossref: "Crossref",
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
};

function cleanDoi(doi: string): string | null {
  const d = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return /^10\.\d{4,9}\/\S+$/.test(d) ? d : null;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "verified") return <CheckCircle2 className="size-4 text-primary shrink-0" aria-hidden="true" />;
  if (status === "unverifiable" || status === "unknown") return <CircleHelp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />;
  return <XCircle className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />;
}

export function ReferenceVerification({ verification }: { verification: RefVerification | null }) {
  if (!verification) {
    return (
      <ScienceCard title="Reference verification" icon={BookOpenCheck}>
        <NotAvailable>References have not been checked against bibliographic databases for this paper yet.</NotAvailable>
      </ScienceCard>
    );
  }
  const v = verification;
  const sources = Object.entries(v.sources).filter(([, n]) => n > 0);
  const verifiedRatio = v.total && v.verified !== null ? v.verified / v.total : null;

  return (
    <ScienceCard
      title="Reference verification"
      icon={BookOpenCheck}
      description="Each cited reference is looked up in public bibliographic databases. Unverifiable does not mean fabricated — it means no match was found."
    >
      {v.ghost_citation_flag && (
        <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Possible ghost citations.</span> More than half of the references could not be matched to a real publication.
          </span>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-4">
        <div>
          <dt className="text-sm text-muted-foreground">Verified</dt>
          <dd className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {fmtInt(v.verified)}
            <span className="text-base font-normal text-muted-foreground"> / {fmtInt(v.total)}</span>
          </dd>
          {verifiedRatio !== null && <dd className="text-xs text-muted-foreground tabular-nums">{fmtPct(verifiedRatio)}</dd>}
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Unverifiable</dt>
          <dd className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">{fmtInt(v.unverifiable)}</dd>
          {v.unverifiable_ratio !== null && <dd className="text-xs text-muted-foreground tabular-nums">{fmtPct(v.unverifiable_ratio)}</dd>}
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Sources</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {sources.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              sources.map(([s, n]) => (
                <Pill key={s} tone="neutral">
                  {SOURCE_LABELS[s] ?? humanize(s)} <span className="tabular-nums text-muted-foreground">{n}</span>
                </Pill>
              ))
            )}
          </dd>
        </div>
      </dl>

      {v.items.length > 0 && (
        <details className="group mt-6 rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 text-muted-foreground motion-safe:transition-transform group-open:rotate-90" aria-hidden="true" />
            All references ({v.items.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {v.items.map((item, i) => {
              const doi = item.doi ? cleanDoi(item.doi) : null;
              return (
                <li key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground break-words">{item.title ?? item.ref}</p>
                    {item.title && item.ref && item.ref !== item.title && (
                      <p className="text-xs text-muted-foreground break-words mt-0.5">{item.ref}</p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{humanize(item.status)}</span>
                      {item.source && <span>via {SOURCE_LABELS[item.source] ?? humanize(item.source)}</span>}
                      {doi && (
                        <a
                          href={`https://doi.org/${encodeURI(doi)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        >
                          {doi}
                          <ExternalLink className="size-3" aria-hidden="true" />
                          <span className="sr-only">(opens doi.org in a new tab)</span>
                        </a>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </ScienceCard>
  );
}
