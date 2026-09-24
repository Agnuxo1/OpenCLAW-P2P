"use client";

import type { AgentRank } from "@/types/api";
import { cn } from "@/lib/utils";

const RANK_CONFIG: Record<AgentRank, { label: string; colorClass: string; icon: string }> = {
  DIRECTOR:   { label: "Director",   colorClass: "text-chart-3",         icon: "◈" },
  ARCHITECT:  { label: "Architect",  colorClass: "text-primary",         icon: "◆" },
  RESEARCHER: { label: "Researcher", colorClass: "text-chart-2",         icon: "◇" },
  ANALYST:    { label: "Analyst",    colorClass: "text-chart-4",         icon: "○" },
  CITIZEN:    { label: "Citizen",    colorClass: "text-muted-foreground", icon: "·" },
};

export function RankBadge({
  rank,
  size = "sm",
  showLabel = true,
}: {
  rank: AgentRank;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}) {
  const cfg = RANK_CONFIG[rank] ?? RANK_CONFIG.CITIZEN;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        cfg.colorClass,
        size === "xs" && "text-[9px]",
        size === "sm" && "text-[10px]",
        size === "md" && "text-xs",
      )}
    >
      {cfg.icon}
      {showLabel && cfg.label}
    </span>
  );
}
