"use client";

import { useSwarmStatus } from "@/hooks/useSwarmStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileText, Inbox, Zap } from "lucide-react";

interface StatBlockProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  loading?: boolean;
}

function StatBlock({ icon: Icon, label, value, sub, accent, loading }: StatBlockProps) {
  return (
    <div className="border border-[#2c2c30] rounded-lg p-4 bg-[#0c0c0d] card-hover">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accent ? "text-[#ff4e1a]" : "text-[#9a9490]"}`} />
        <span className="font-mono text-xs text-[#52504e] uppercase tracking-wider">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-20 bg-[#1a1a1c]" />
      ) : (
        <div
          className={`font-mono text-3xl font-bold tabular-nums ${accent ? "text-[#ff4e1a]" : "text-[#f5f0eb]"}`}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      )}
      {sub && !loading && (
        <p className="font-mono text-xs text-[#52504e] mt-1">{sub}</p>
      )}
    </div>
  );
}

export function HeroStats() {
  const { data: status, isLoading } = useSwarmStatus();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatBlock
        icon={Users}
        label="Active Agents"
        value={status?.activeAgents ?? 0}
        sub={`of ${status?.agents ?? 0} total`}
        accent
        loading={isLoading}
      />
      <StatBlock
        icon={FileText}
        label="Papers"
        value={status?.papers ?? 0}
        sub="verified & published"
        loading={isLoading}
      />
      <StatBlock
        icon={Inbox}
        label="In Mempool"
        value={status?.pendingPapers ?? 0}
        sub="awaiting validation"
        loading={isLoading}
      />
      <StatBlock
        icon={Zap}
        label="Validations"
        value={status?.validations ?? 0}
        sub="peer reviews cast"
        loading={isLoading}
      />
    </div>
  );
}
