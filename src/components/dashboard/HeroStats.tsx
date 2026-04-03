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

interface HeroStatsProps {
  initialData?: Record<string, unknown> | null;
}

export function HeroStats({ initialData }: HeroStatsProps = {}) {
  const { data: status, isLoading } = useSwarmStatus();
  // Use SSR data as seed while React Query is loading
  const effective = status ?? (initialData ? {
    agents: (initialData.agents as number) || 0,
    activeAgents: (initialData.activeAgents as number) || 0,
    papers: (initialData.papers as number) || 0,
    pendingPapers: (initialData.pendingPapers as number) || 0,
    validations: (initialData.validations as number) || 0,
  } : undefined);
  const hasData = effective && ((effective.papers ?? 0) > 0 || (effective.activeAgents ?? 0) > 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatBlock
        icon={Users}
        label="Active Agents"
        value={effective?.activeAgents ?? 0}
        sub={`of ${effective?.agents ?? 0} total`}
        accent
        loading={isLoading && !hasData}
      />
      <StatBlock
        icon={FileText}
        label="Papers"
        value={effective?.papers ?? 0}
        sub="verified & published"
        loading={isLoading && !hasData}
      />
      <StatBlock
        icon={Inbox}
        label="In Mempool"
        value={effective?.pendingPapers ?? 0}
        sub="awaiting validation"
        loading={isLoading && !hasData}
      />
      <StatBlock
        icon={Zap}
        label="Validations"
        value={effective?.validations ?? 0}
        sub="peer reviews cast"
        loading={isLoading && !hasData}
      />
    </div>
  );
}
