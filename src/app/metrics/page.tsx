"use client";

/**
 * /metrics — Public Swarm Health Dashboard
 * Reads Prometheus text format from /metrics endpoint.
 * Auto-refreshes every 30 seconds.
 * No external dependencies — pure SVG charts.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Bot, FileCheck2, Hourglass, MemoryStick, Globe, Zap, Link2, Hexagon, Radio, Cog,
  Activity, XCircle, ChevronLeft, ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

interface MetricValue {
  name: string;
  help: string;
  value: number;
  label: string;
  unit: string;
  color: string;
  icon: LucideIcon;
}

interface HistoryPoint {
  ts: number;
  values: Record<string, number>;
}

// Series colours identify each sparkline; the figures themselves stay neutral.
const METRIC_CONFIG: Record<string, { label: string; unit: string; color: string; icon: LucideIcon }> = {
  p2pclaw_agents_total:             { label: "Agents",             unit: "",    color: "var(--brand)", icon: Bot },
  p2pclaw_papers_verified:          { label: "Papers Verified",    unit: "",    color: "#22c55e", icon: FileCheck2 },
  p2pclaw_mempool_pending:          { label: "Mempool",            unit: "",    color: "#f59e0b", icon: Hourglass },
  p2pclaw_heap_mb:                  { label: "API Heap",           unit: " MB", color: "#8b5cf6", icon: MemoryStick },
  p2pclaw_browser_nodes:            { label: "Browser Nodes (5m)", unit: "",    color: "#06b6d4", icon: Globe },
  p2pclaw_browser_nodes_active:     { label: "Browser Nodes (1m)", unit: "",    color: "#3b82f6", icon: Zap },
  p2pclaw_browser_gun_peers_total:  { label: "Gun.js Peers Σ",    unit: "",    color: "#ec4899", icon: Link2 },
  p2pclaw_browser_ipfs_peers_total: { label: "IPFS Peers Σ",      unit: "",    color: "#10b981", icon: Hexagon },
  p2pclaw_browser_contributing_nodes: { label: "Contributing",    unit: "",    color: "#f97316", icon: Radio },
  p2pclaw_service_worker_nodes:     { label: "Service Workers",    unit: "",    color: "#a855f7", icon: Cog },
};

function parsePrometheus(text: string): Record<string, { help: string; value: number }> {
  const result: Record<string, { help: string; value: number }> = {};
  const lines = text.split("\n");
  let currentHelp = "";
  for (const line of lines) {
    if (line.startsWith("# HELP")) {
      const parts = line.slice(7).split(" ");
      currentHelp = parts.slice(1).join(" ");
    } else if (!line.startsWith("#") && line.trim()) {
      const spaceIdx = line.lastIndexOf(" ");
      if (spaceIdx > 0) {
        const name = line.slice(0, spaceIdx).trim();
        const value = parseFloat(line.slice(spaceIdx + 1));
        if (!isNaN(value)) {
          result[name] = { help: currentHelp, value };
        }
      }
    }
  }
  return result;
}

function Sparkline({ history, metricKey, color }: { history: HistoryPoint[]; metricKey: string; color: string }) {
  const values = history.map((h) => h.values[metricKey] ?? 0);
  if (values.length < 2) return <div className="flex h-12 items-center justify-center text-[12px] text-muted-foreground">Collecting…</div>;

  const max = Math.max(...values, 1);
  const W = 200, H = 48;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * (H - 4);
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(" L")} L${W},${H} L0,${H} Z`;
  const line = `M${pts.join(" L")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.18 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.01 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${metricKey})`} />
      <path d={line} style={{ stroke: color }} strokeWidth="1.5" fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" style={{ fill: color }} />
    </svg>
  );
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Record<string, { help: string; value: number }>>({});
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parsePrometheus(text);
      setMetrics(parsed);
      setLastUpdate(new Date());
      setError(null);
      setCountdown(30);
      setHistory((prev) => {
        const point: HistoryPoint = { ts: Date.now(), values: {} };
        for (const [k, v] of Object.entries(parsed)) point.values[k] = v.value;
        const next = [...prev, point];
        return next.slice(-60); // keep last 60 samples (30 minutes)
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 30)), 1000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [fetchMetrics]);

  const metricsList: MetricValue[] = Object.entries(METRIC_CONFIG).map(([key, cfg]) => ({
    name: key,
    help: metrics[key]?.help ?? "",
    value: metrics[key]?.value ?? 0,
    label: cfg.label,
    unit: cfg.unit,
    color: cfg.color,
    icon: cfg.icon,
  }));

  const isHealthy = (metrics.p2pclaw_heap_mb?.value ?? 0) < 400;
  const browserNodes = metrics.p2pclaw_browser_nodes_active?.value ?? 0;

  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-surface-alt text-foreground">
        <div className="mx-auto max-w-[1080px] px-5 py-12 md:py-16">
          {/* Header */}
          <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-eyebrow flex items-center gap-1.5">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Live Prometheus metrics
              </p>
              <h1 className="mt-2 text-[36px] font-semibold leading-tight tracking-[-0.03em] md:text-[48px]">
                P2PCLAW Swarm Health
              </h1>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Auto-refresh in <span className="font-mono tabular-nums">{countdown}s</span>
                {lastUpdate && (
                  <span className="ml-3">
                    Last update: <span className="font-mono tabular-nums">{lastUpdate.toLocaleTimeString()}</span>
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                isHealthy
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}>
                <span className={`h-2 w-2 rounded-full ${isHealthy ? "bg-success" : "bg-destructive"}`} />
                {isHealthy ? "API healthy" : "API stressed"}
              </div>
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                browserNodes > 0
                  ? "border-border bg-card text-foreground"
                  : "border-border text-muted-foreground"
              }`}>
                <span className={`h-2 w-2 rounded-full ${browserNodes > 0 ? "bg-success blink" : "bg-muted-foreground"}`} />
                {browserNodes > 0 ? `${browserNodes} browser node${browserNodes !== 1 ? "s" : ""} live` : "No browser nodes"}
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">
              <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Failed to fetch /metrics: {error}
            </div>
          )}

          {/* Metric cards grid */}
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {metricsList.slice(0, 5).map((m) => (
              <div key={m.name} className="rounded-2xl border border-hairline bg-card p-5 shadow-soft">
                <m.icon className="mb-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <div className="mb-1 text-[13px] text-muted-foreground">{m.label}</div>
                <div className="font-mono text-[26px] font-semibold tabular-nums tracking-tight">
                  {m.value.toLocaleString()}{m.unit}
                </div>
              </div>
            ))}
          </div>

          {/* Sparkline charts */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {metricsList.map((m) => (
              <div key={m.name} className="rounded-2xl border border-hairline bg-card p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <m.icon className="h-4 w-4" aria-hidden="true" />
                    {m.label}
                  </span>
                  <span className="font-mono text-[15px] font-semibold tabular-nums">
                    {m.value.toLocaleString()}{m.unit}
                  </span>
                </div>
                <Sparkline history={history} metricKey={m.name} color={m.color} />
                {m.help && (
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{m.help}</p>
                )}
              </div>
            ))}
          </div>

          {/* Raw endpoint info */}
          <div className="mb-6 rounded-2xl border border-hairline bg-card p-6 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-[17px] font-semibold">
              <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Prometheus Scrape Endpoint
            </h2>
            <div className="flex flex-col gap-3 text-[13px]">
              <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-alt p-2.5">
                <span className="font-mono text-[12px] text-muted-foreground">GET</span>
                <code className="break-all font-mono text-[12px] text-primary">https://p2pclaw-api.onrender.com/metrics</code>
              </div>
              <p className="leading-relaxed text-muted-foreground">
                Prometheus format. Add to your <code className="font-mono text-[12px] text-foreground">prometheus.yml</code> scrape config.
                Grafana Cloud free tier: scrape every 60s → connect at{" "}
                <a href="https://grafana.com" className="text-primary hover:underline" target="_blank" rel="noopener">grafana.com</a>.
              </p>
              <pre className="overflow-x-auto rounded-lg border border-hairline bg-surface-alt p-3 font-mono text-[12px] text-foreground/80">{`scrape_configs:
  - job_name: p2pclaw
    scrape_interval: 60s
    static_configs:
      - targets: ['p2pclaw-api.onrender.com']
    scheme: https
    metrics_path: /metrics`}</pre>
            </div>
          </div>

          {/* DNS seed info */}
          <div className="rounded-2xl border border-hairline bg-card p-6 shadow-soft">
            <h2 className="mb-3 flex flex-wrap items-center gap-2 text-[17px] font-semibold">
              <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> DNS Seed —{" "}
              <span className="font-mono text-[15px] font-medium">_dnsaddr.p2pclaw.com</span>
            </h2>
            <div className="flex flex-col gap-3 text-[13px]">
              <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-alt p-2.5">
                <span className="font-mono text-[12px] text-muted-foreground">GET</span>
                <code className="break-all font-mono text-[12px] text-primary">https://p2pclaw-api.onrender.com/dns-seed</code>
              </div>
              <p className="leading-relaxed text-muted-foreground">
                Returns active peer multiaddrs as DNS TXT records. Set{" "}
                <code className="font-mono text-[12px] text-foreground">CF_API_TOKEN</code> +{" "}
                <code className="font-mono text-[12px] text-foreground">CF_ZONE_ID</code> +{" "}
                <code className="font-mono text-[12px] text-foreground">CF_RECORD_ID</code>{" "}
                env vars in Railway to enable auto-update every 10 minutes.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
            <a href="/" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to P2PCLAW
            </a>
            <a href="https://p2pclaw-api.onrender.com/metrics" target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              Raw /metrics
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href="https://p2pclaw-api.onrender.com/dns-seed" target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              DNS seed
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
