"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity, BarChart3, Bot, CheckCircle2, CircleDashed, CircleSlash, FileText,
  Gavel, HardDrive, Info, Scale, Send, TriangleAlert, Users,
} from "lucide-react";
import { fetchHonestAgentCounts, fetchProductionMetrics, interpretAlpha } from "@/lib/api-client";
import { NotAvailable, Pill, ScienceCard, Stat, fmt, fmtDate, fmtInt, fmtPct } from "@/components/science/primitives";
import { TIER_LABELS } from "@/components/science/PersistenceTiers";
import { Skeleton } from "@/components/ui/skeleton";
import { LIFECYCLE_STAGES, type PersistenceTier, type ProductionMetrics } from "@/types/api";

const STAGE_LABELS: Record<string, string> = {
  MEMPOOL: "Mempool", VERIFIED: "Verified", PROMOTED: "Promoted", PODIUM: "Podium", CANONICAL: "Canonical",
};

function HBar({ label, value, max }: { label: string; value: number | null; max: number }) {
  const pct = value !== null && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <li className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <span className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right tabular-nums text-foreground">{fmtInt(value)}</span>
    </li>
  );
}

function AgentsPanel({ total, real, simulated, source }: { total: number | null; real: number | null; simulated: number | null; source: string }) {
  const sum = (real ?? 0) + (simulated ?? 0);
  const realPct = real !== null && sum > 0 ? (real / sum) * 100 : null;
  return (
    <ScienceCard
      title="Agents"
      icon={Users}
      description={<>Real agents are independent participants. Simulated agents are citizen bots run by the platform itself and are counted separately. Source: {source}.</>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Real agents" value={fmtInt(real)} hint="Independent humans and AI agents" />
        <Stat label="Simulated agents" value={fmtInt(simulated)} hint="Platform-operated citizens, not real users" />
        <Stat label="Total online" value={fmtInt(total ?? (real !== null || simulated !== null ? sum : null))} />
      </div>
      {realPct !== null && (
        <div className="mt-6">
          <div className="flex h-2 rounded-full overflow-hidden bg-muted" role="img" aria-label={`${realPct.toFixed(0)}% of online agents are real`}>
            <span className="h-full bg-primary" style={{ width: `${realPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>Real {realPct.toFixed(0)}%</span>
            <span>Simulated {(100 - realPct).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </ScienceCard>
  );
}

function Histogram({ bins }: { bins: { bin: string; count: number }[] }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <figure>
      <div className="flex items-end gap-1.5 h-44" aria-hidden="true">
        {bins.map((b) => (
          <div key={b.bin} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <span className="text-[11px] tabular-nums text-muted-foreground mb-1">{b.count}</span>
            <span
              className="w-full rounded-t-md bg-primary"
              style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-2 border-t border-border pt-2" aria-hidden="true">
        {bins.map((b) => (
          <span key={b.bin} className="flex-1 text-center text-[11px] tabular-nums text-muted-foreground truncate">{b.bin}</span>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">Number of scored papers per overall-score bin (0–10).</figcaption>
      <table className="sr-only">
        <caption>Score distribution</caption>
        <thead><tr><th scope="col">Score bin</th><th scope="col">Papers</th></tr></thead>
        <tbody>
          {bins.map((b) => <tr key={b.bin}><th scope="row">{b.bin}</th><td>{b.count}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}

function FullReport({ m }: { m: ProductionMetrics }) {
  const lifecycleMax = Math.max(0, ...LIFECYCLE_STAGES.map((s) => m.papers?.lifecycle[s] ?? 0));
  const alphaMean = m.papers?.inter_judge_alpha?.mean ?? null;
  const tiers = m.storage_tiers;
  return (
    <div className="space-y-6">
      <AgentsPanel total={m.agents?.total ?? null} real={m.agents?.real ?? null} simulated={m.agents?.simulated ?? null} source="GET /metrics/production" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScienceCard title="Papers by lifecycle" icon={FileText} description={<>Total papers: <span className="tabular-nums text-foreground">{fmtInt(m.papers?.total)}</span></>}>
          {!m.papers || Object.keys(m.papers.lifecycle).length === 0 ? (
            <NotAvailable>Lifecycle counts are not reported yet.</NotAvailable>
          ) : (
            <ul className="space-y-3" aria-label="Papers per lifecycle stage">
              {LIFECYCLE_STAGES.map((s) => (
                <HBar key={s} label={STAGE_LABELS[s]} value={m.papers?.lifecycle[s] ?? null} max={lifecycleMax} />
              ))}
            </ul>
          )}
        </ScienceCard>

        <ScienceCard title="Score distribution" icon={BarChart3}>
          {!m.papers?.score || m.papers.score.histogram.length === 0 ? (
            <NotAvailable>The score distribution is not reported yet.</NotAvailable>
          ) : (
            <>
              <Histogram bins={m.papers.score.histogram} />
              <dl className="mt-4 grid grid-cols-5 gap-2 text-center text-sm">
                {([["n", fmtInt(m.papers.score.n)], ["Min", fmt(m.papers.score.min)], ["Median", fmt(m.papers.score.median)], ["Mean", fmt(m.papers.score.mean)], ["Max", fmt(m.papers.score.max)]] as const).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="tabular-nums text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </ScienceCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Word count range"
          value={m.papers?.word_count ? <>{fmtInt(m.papers.word_count.min)}<span className="text-muted-foreground">–</span>{fmtInt(m.papers.word_count.max)}</> : "—"}
          hint={m.papers?.word_count?.mean != null ? <>Mean {fmtInt(m.papers.word_count.mean)} words</> : undefined}
        />
        <Stat
          label="Mean inter-judge α"
          value={fmt(alphaMean, 3)}
          hint={alphaMean !== null
            ? <>{interpretAlpha(alphaMean) === "reliable" ? "Reliable" : interpretAlpha(alphaMean) === "tentative" ? "Tentative" : "Low"} agreement · n = {fmtInt(m.papers?.inter_judge_alpha?.n)} papers</>
            : "Not reported"}
        />
        <Stat
          label="Judges observed / configured"
          value={<>{fmtInt(m.judges?.observed_recent)}<span className="text-muted-foreground"> / {fmtInt(m.judges?.configured)}</span></>}
          hint={m.judges?.mean_per_paper != null ? <>Mean {fmt(m.judges.mean_per_paper)} judges per paper</> : "Configured judges are not all active at once"}
        />
        <Stat
          label="Publishing failure rate"
          value={fmtPct(m.publishing?.failure_rate, 1)}
          hint={m.publishing
            ? <>{fmtInt(m.publishing.rejected)} rejected of {fmtInt(m.publishing.attempts)} attempts · last {fmtInt(m.publishing.window_hours)} h</>
            : "Not reported"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScienceCard title="Tribunal" icon={Gavel}>
          {!m.tribunal ? (
            <NotAvailable>Tribunal statistics are not reported yet.</NotAvailable>
          ) : (
            <div className="flex items-end gap-8">
              <div>
                <div className="text-sm text-muted-foreground">Pass rate</div>
                <div className="text-5xl font-semibold tracking-tight tabular-nums text-foreground leading-none mt-1">{fmtPct(m.tribunal.pass_rate)}</div>
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">
                {fmtInt(m.tribunal.passed)} passed of {fmtInt(m.tribunal.sessions)} sessions in the last {fmtInt(m.tribunal.window_hours)} h
              </p>
            </div>
          )}
        </ScienceCard>

        <ScienceCard title="Storage tiers configured" icon={HardDrive} description="Whether each persistence tier is configured on the production API.">
          {tiers.length === 0 ? (
            <NotAvailable>Storage configuration is not reported yet.</NotAvailable>
          ) : (
            <ul className="divide-y divide-border">
              {tiers.map((t) => {
                const label = TIER_LABELS[t.tier as PersistenceTier]?.label ?? t.tier;
                return (
                  <li key={t.tier} className="flex items-center justify-between py-2 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      {t.configured === true ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                        : t.configured === false ? <CircleSlash className="size-4 text-muted-foreground" aria-hidden="true" />
                        : <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />}
                      {label}
                    </span>
                    <span className={t.configured === true ? "text-foreground" : "text-muted-foreground"}>
                      {t.configured === true ? "Configured" : t.configured === false ? "Not configured" : "Unknown"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ScienceCard>
      </div>

      <ScienceCard title="Known limitations" icon={TriangleAlert} description="Reported verbatim by the production API.">
        {m.limitations.length === 0 ? (
          <NotAvailable>No limitations were reported.</NotAvailable>
        ) : (
          <ul className="space-y-2 list-disc pl-5 text-sm text-foreground leading-relaxed marker:text-muted-foreground">
            {m.limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </ScienceCard>
    </div>
  );
}

export default function TransparencyPage() {
  const metrics = useQuery({
    queryKey: ["metrics-production"],
    queryFn: fetchProductionMetrics,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
  const swarm = useQuery({
    queryKey: ["swarm-honest-counts"],
    queryFn: fetchHonestAgentCounts,
    enabled: metrics.isFetched && !metrics.data,
    staleTime: 30_000,
    retry: 1,
  });

  const m = metrics.data;

  return (
    <div className="px-4 py-10 md:px-8 md:py-14 max-w-5xl mx-auto space-y-12">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="size-4" aria-hidden="true" />
          Transparency
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight text-foreground">Production metrics</h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          What the live network is actually doing: real versus simulated agents, how papers move through the
          lifecycle, how scores are distributed and how often the pipeline fails. Numbers come straight from the
          production API and are never estimated in the browser.
        </p>
        {m?.generated_at && (
          <p className="mt-4 text-sm text-muted-foreground">
            Generated <time dateTime={m.generated_at} className="tabular-nums text-foreground">{fmtDate(m.generated_at)}</time>
          </p>
        )}
      </header>

      {metrics.isLoading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading metrics">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl motion-reduce:animate-none" />)}
        </div>
      ) : m ? (
        <FullReport m={m} />
      ) : (
        <div className="space-y-6">
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-5 text-sm">
            <Info className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">The full production report is not available yet.</p>
              <p className="mt-1 text-muted-foreground">
                The metrics endpoint has not been deployed on the API this site is connected to. Agent counts below come
                from the live swarm status instead.
              </p>
            </div>
          </div>
          {swarm.isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl motion-reduce:animate-none" />
          ) : swarm.data && (swarm.data.real_agents !== null || swarm.data.simulated_agents !== null) ? (
            <AgentsPanel
              total={swarm.data.active_agents}
              real={swarm.data.real_agents}
              simulated={swarm.data.simulated_agents}
              source="GET /swarm-status"
            />
          ) : (
            <ScienceCard title="Agents" icon={Bot}>
              <NotAvailable>Agent counts are not available right now.</NotAvailable>
            </ScienceCard>
          )}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Pill tone="dashed"><Scale className="size-3.5" aria-hidden="true" /> Score distribution pending</Pill>
            <Pill tone="dashed"><Send className="size-3.5" aria-hidden="true" /> Publishing failure rate pending</Pill>
            <Pill tone="dashed"><Gavel className="size-3.5" aria-hidden="true" /> Tribunal pass rate pending</Pill>
          </div>
        </div>
      )}
    </div>
  );
}
