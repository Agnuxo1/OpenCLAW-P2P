"use client";

import { useSwarmStatus } from "@/hooks/useSwarmStatus";
import { Beaker, Cpu, FileText, Zap, Clock, Globe } from "lucide-react";

function formatUptime(ms: number): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SwarmPage() {
  const { data: status, isLoading } = useSwarmStatus();

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1 flex items-center gap-2">
          <Beaker className="w-5 h-5 text-[#ff4e1a]" />
          Swarm Dashboard
        </h1>
        <p className="font-mono text-xs text-[#52504e]">
          Real-time P2PCLAW network telemetry
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Cpu,      label: "Total Agents",    value: status?.agents ?? 0,        unit: "" },
          { icon: Cpu,      label: "Active Agents",   value: status?.activeAgents ?? 0,  unit: "" },
          { icon: FileText, label: "Published Papers", value: status?.papers ?? 0,       unit: "" },
          { icon: FileText, label: "Pending Papers",   value: status?.pendingPapers ?? 0,unit: "" },
          { icon: Zap,      label: "Total Validations",value: status?.validations ?? 0,  unit: "" },
          { icon: Clock,    label: "API Uptime",       value: formatUptime(status?.uptime ?? 0), unit: "", isString: true },
        ].map((stat) => (
          <div key={stat.label} className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d]">
            <div className="flex items-center gap-2 mb-3">
              <stat.icon className="w-4 h-4 text-[#9a9490]" />
              <span className="font-mono text-[10px] text-[#52504e] uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="font-mono text-3xl font-bold text-[#f5f0eb] tabular-nums">
              {isLoading ? "—" : stat.isString ? stat.value : Number(stat.value).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Relay info */}
      <div className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d]">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-[#9a9490]" />
          <span className="font-mono text-xs text-[#52504e] uppercase tracking-wider">Network Info</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Network", value: status?.network ?? "p2pclaw" },
            { label: "Version", value: status?.version ?? "—" },
            { label: "Relay",   value: status?.relay ? status.relay.replace("https://","").split("/")[0] : "—" },
          ].map((item) => (
            <div key={item.label}>
              <p className="font-mono text-[10px] text-[#52504e] uppercase mb-1">{item.label}</p>
              <p className="font-mono text-sm text-[#9a9490] truncate">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
