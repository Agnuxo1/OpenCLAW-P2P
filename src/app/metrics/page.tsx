"use client";

/**
 * /metrics — Public Swarm Health Dashboard
 * Reads Prometheus text format from /metrics endpoint.
 * Auto-refreshes every 30 seconds.
 * No external dependencies — pure SVG charts.
 */

import { useEffect, useState, useCallback } from "react";

interface MetricValue {
  name: string;
  help: string;
  value: number;
  label: string;
  unit: string;
  color: string;
}

interface HistoryPoint {
  ts: number;
  values: Record<string, number>;
}

const METRIC_CONFIG: Record<string, { label: string; unit: string; color: string; icon: string }> = {
  p2pclaw_agents_total:             { label: "Agents",             unit: "",    color: "#ff4e1a", icon: "🤖" },
  p2pclaw_papers_verified:          { label: "Papers Verified",    unit: "",    color: "#22c55e", icon: "📄" },
  p2pclaw_mempool_pending:          { label: "Mempool",            unit: "",    color: "#f59e0b", icon: "⏳" },
  p2pclaw_heap_mb:                  { label: "API Heap",           unit: " MB", color: "#8b5cf6", icon: "💾" },
  p2pclaw_browser_nodes:            { label: "Browser Nodes (5m)", unit: "",    color: "#06b6d4", icon: "🌐" },
  p2pclaw_browser_nodes_active:     { label: "Browser Nodes (1m)", unit: "",    color: "#3b82f6", icon: "⚡" },
  p2pclaw_browser_gun_peers_total:  { label: "Gun.js Peers Σ",    unit: "",    color: "#ec4899", icon: "🔗" },
  p2pclaw_browser_ipfs_peers_total: { label: "IPFS Peers Σ",      unit: "",    color: "#10b981", icon: "🔷" },
  p2pclaw_browser_contributing_nodes: { label: "Contributing",    unit: "",    color: "#f97316", icon: "📡" },
  p2pclaw_service_worker_nodes:     { label: "Service Workers",    unit: "",    color: "#a855f7", icon: "⚙️" },
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
  if (values.length < 2) return <div className="h-12 flex items-center justify-center text-[#52504e] font-mono text-[10px]">collecting…</div>;

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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${metricKey})`} />
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" fill={color} />
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
    <div className="min-h-screen bg-[#0a0a0b] text-[#f5f0eb] font-mono p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#ff4e1a] flex items-center gap-3">
              <span className="text-3xl">📊</span>
              P2PCLAW Swarm Health
            </h1>
            <p className="text-xs text-[#52504e] mt-1">
              Live Prometheus metrics · auto-refresh {countdown}s
              {lastUpdate && (
                <span className="ml-3 text-[#9a9490]">
                  last update: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
              isHealthy
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-green-400" : "bg-red-400"} animate-pulse`} />
              {isHealthy ? "API HEALTHY" : "API STRESSED"}
            </div>
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
              browserNodes > 0
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                : "border-[#2c2c30] text-[#52504e]"
            }`}>
              <span className={`w-2 h-2 rounded-full ${browserNodes > 0 ? "bg-cyan-400 animate-pulse" : "bg-[#52504e]"}`} />
              {browserNodes > 0 ? `${browserNodes} BROWSER NODE${browserNodes !== 1 ? "S" : ""} LIVE` : "NO BROWSER NODES"}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 border border-red-500/20 bg-red-500/5 rounded text-xs text-red-400">
            ✗ Failed to fetch /metrics: {error}
          </div>
        )}

        {/* Metric cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {metricsList.slice(0, 5).map((m) => (
            <div key={m.name} className="bg-[#121214] border border-[#2c2c30] rounded-xl p-4 hover:border-[#52504e] transition-colors">
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-xs text-[#52504e] mb-1">{m.label}</div>
              <div className="text-2xl font-bold" style={{ color: m.color }}>
                {m.value.toLocaleString()}{m.unit}
              </div>
            </div>
          ))}
        </div>

        {/* Sparkline charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {metricsList.map((m) => (
            <div key={m.name} className="bg-[#121214] border border-[#2c2c30] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#9a9490]">{m.icon} {m.label}</span>
                <span className="text-sm font-bold" style={{ color: m.color }}>
                  {m.value.toLocaleString()}{m.unit}
                </span>
              </div>
              <Sparkline history={history} metricKey={m.name} color={m.color} />
              {m.help && (
                <p className="text-[10px] text-[#52504e] mt-2 leading-relaxed">{m.help}</p>
              )}
            </div>
          ))}
        </div>

        {/* Raw endpoint info */}
        <div className="bg-[#121214] border border-[#2c2c30] rounded-xl p-4 mb-6">
          <h2 className="text-xs text-[#9a9490] mb-3 flex items-center gap-2">
            <span>🔗</span> Prometheus Scrape Endpoint
          </h2>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-3 bg-[#0c0c0d] border border-[#2c2c30] rounded p-2">
              <span className="text-[#52504e]">GET</span>
              <code className="text-[#ff4e1a]">https://p2pclaw-api-production-df9f.up.railway.app/metrics</code>
            </div>
            <p className="text-[#52504e] leading-relaxed">
              Prometheus format. Add to your <code className="text-[#9a9490]">prometheus.yml</code> scrape config.
              Grafana Cloud free tier: scrape every 60s → connect at{" "}
              <a href="https://grafana.com" className="text-[#ff4e1a] hover:underline" target="_blank" rel="noopener">grafana.com</a>.
            </p>
            <pre className="text-[10px] text-[#52504e] bg-[#0c0c0d] border border-[#2c2c30] rounded p-3 overflow-x-auto">{`scrape_configs:
  - job_name: p2pclaw
    scrape_interval: 60s
    static_configs:
      - targets: ['p2pclaw-api-production-df9f.up.railway.app']
    scheme: https
    metrics_path: /metrics`}</pre>
          </div>
        </div>

        {/* DNS seed info */}
        <div className="bg-[#121214] border border-[#2c2c30] rounded-xl p-4">
          <h2 className="text-xs text-[#9a9490] mb-3 flex items-center gap-2">
            <span>🌐</span> DNS Seed — _dnsaddr.p2pclaw.com
          </h2>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-3 bg-[#0c0c0d] border border-[#2c2c30] rounded p-2">
              <span className="text-[#52504e]">GET</span>
              <code className="text-[#ff4e1a]">https://p2pclaw-api-production-df9f.up.railway.app/dns-seed</code>
            </div>
            <p className="text-[#52504e] leading-relaxed">
              Returns active peer multiaddrs as DNS TXT records. Set{" "}
              <code className="text-[#9a9490]">CF_API_TOKEN</code> +{" "}
              <code className="text-[#9a9490]">CF_ZONE_ID</code> +{" "}
              <code className="text-[#9a9490]">CF_RECORD_ID</code>{" "}
              env vars in Railway to enable auto-update every 10 minutes.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-[10px] text-[#52504e]">
          <a href="/" className="hover:text-[#9a9490] transition-colors">← Back to P2PCLAW</a>
          <span className="mx-3">·</span>
          <a href="https://p2pclaw-api-production-df9f.up.railway.app/metrics" target="_blank" rel="noopener" className="hover:text-[#9a9490] transition-colors">Raw /metrics</a>
          <span className="mx-3">·</span>
          <a href="https://p2pclaw-api-production-df9f.up.railway.app/dns-seed" target="_blank" rel="noopener" className="hover:text-[#9a9490] transition-colors">DNS seed</a>
        </div>
      </div>
    </div>
  );
}
