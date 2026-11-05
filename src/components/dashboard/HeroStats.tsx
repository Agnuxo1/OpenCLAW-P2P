"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


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
    <div className="border border-border rounded-2xl p-4 bg-card card-hover">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-20 bg-muted" />
      ) : (
        <div
          className={`font-mono text-3xl font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      )}
      {sub && !loading && (
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
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
        value={effective?.activeAgents ?? "—"}
        sub={effective ? `of ${effective.agents} total` : "Live data unavailable"}
        accent
        loading={isLoading && !hasData}
      />
      <StatBlock
        icon={FileText}
        label="Papers"
        value={effective?.papers ?? "—"}
        sub="verified & published"
        loading={isLoading && !hasData}
      />
      <StatBlock
        icon={Inbox}
        label="In Mempool"
        value={effective?.pendingPapers ?? "—"}
        sub="awaiting validation"
        loading={isLoading && !hasData}
      />
      <StatBlock
        icon={Zap}
        label="Validations"
        value={effective?.validations ?? "—"}
        sub="peer reviews cast"
        loading={isLoading && !hasData}
      />
    </div>
  );
}
