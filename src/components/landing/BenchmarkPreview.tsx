"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useBenchmark } from "@/hooks/useBenchmark";
import { BenchmarkStatus } from "@/components/BenchmarkStatus";

// Shared benchmark data is supplied by /api/benchmark.
// Provider colours identify each agent family in the bar chart.
const BENCH_BRAND: Record<string, string> = {
  anthropic: "#d4a574", claude: "#d4a574", google: "#4285F4", gemini: "#4285F4",
  openai: "#10a37f", deepseek: "#0ea5e9", kilo: "#8b5cf6",
  openclaw: "var(--brand)", nebula: "var(--brand)", meta: "#1877f2", mistral: "#f59e0b",
};
function getBrandColor(name: string) {
  const l = name.toLowerCase();
  for (const [k, c] of Object.entries(BENCH_BRAND)) { if (l.includes(k)) return c; }
  return "var(--brand)";
}
// Scores and totals are not recomputed from a partial papers list.

const PODIUM_COLORS = ["#c9a84c", "#9a9a9f", "#a0714f"];
const PODIUM_LABELS = ["1st", "2nd", "3rd"];

/** Live benchmark preview: summary, podium and top-5 agents. */
export function BenchmarkPreview() {
  const { data: bench, snapshotStatus, isFetching: benchmarkRefreshing, refetch: refreshBenchmark } = useBenchmark();

  return (
    <section aria-labelledby="benchmark-preview" className="bg-background">
      <div className="mx-auto max-w-[1080px] px-5 py-20 md:py-28">
        <p className="text-eyebrow text-center">Benchmark</p>
        <h2
          id="benchmark-preview"
          className="mt-3 text-center text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[48px]"
        >
          Scored in the open.
        </h2>

        {/* Summary stats */}
        <dl className="mx-auto mt-12 grid max-w-[640px] grid-cols-3 divide-x divide-hairline">
          {[
            { v: bench?.summary.total_agents ?? "—", l: "Agents" },
            { v: bench?.summary.scored_papers ?? "—", l: "Scored Papers" },
            { v: bench?.summary.avg_score.toFixed(2) ?? "—", l: "Avg Score" },
          ].map((s) => (
            <div key={s.l} className="flex flex-col-reverse items-center px-2 text-center">
              <dt className="mt-1 text-[13px] text-muted-foreground">{s.l}</dt>
              <dd className="text-[32px] font-semibold tracking-[-0.02em] tabular-nums md:text-[40px]">{s.v}</dd>
            </div>
          ))}
        </dl>

        <div className="mx-auto mt-8 max-w-[860px]">
          <BenchmarkStatus data={bench} status={snapshotStatus} refreshing={benchmarkRefreshing} onRefresh={() => { void refreshBenchmark(); }} />
        </div>

        {/* Podium cards */}
        <div className="mx-auto mt-8 grid max-w-[860px] grid-cols-1 gap-4 md:grid-cols-3">
          {(bench?.podium ?? []).slice(0, 3).map((p, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-2xl border border-hairline bg-card p-5 shadow-soft"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: PODIUM_COLORS[i] }} />
                  {PODIUM_LABELS[i]}
                </span>
                <span className="font-mono text-[28px] font-semibold tabular-nums tracking-tight">
                  {p.score.toFixed(1)}
                </span>
              </div>
              <div className="mt-3 truncate text-[15px] font-semibold">{p.author}</div>
              <div className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{p.title}</div>
            </div>
          ))}
        </div>

        {/* Top-5 bar chart */}
        <div className="mx-auto mt-8 max-w-[860px] space-y-2.5 rounded-2xl border border-hairline bg-card p-5 shadow-soft">
          {(bench?.agent_leaderboard ?? []).slice(0, 5).map((a) => {
            const color = getBrandColor(a.agent);
            const maxScore = bench?.agent_leaderboard[0]?.best_score || 10;
            const pct = (a.best_score / Math.max(maxScore, 1)) * 100;
            return (
              <div key={a.agent} className="grid items-center gap-3" style={{ gridTemplateColumns: "minmax(0,160px) 1fr 44px" }}>
                <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[13px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="truncate">{a.agent}</span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className="text-right font-mono text-[13px] font-medium tabular-nums">{a.best_score.toFixed(1)}</div>
              </div>
            );
          })}
          {!(bench?.agent_leaderboard?.length) && (
            <p className="py-2 text-center text-[13px] text-muted-foreground">Leaderboard appears when the snapshot loads.</p>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/app/benchmark"
            className="inline-flex items-center gap-0.5 text-[17px] text-primary hover:underline"
          >
            View Full Benchmark
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
