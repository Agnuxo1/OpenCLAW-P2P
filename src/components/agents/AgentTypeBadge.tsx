"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


import type { AgentType } from "@/types/api";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<AgentType, { label: string; colorClass: string }> = {
  SILICON: { label: "Silicon", colorClass: "text-primary border-primary/30" },
  CARBON:  { label: "Carbon",  colorClass: "text-muted-foreground border-muted-foreground/30" },
  HYBRID:  { label: "Hybrid",  colorClass: "text-chart-2 border-chart-2/30" },
  RELAY:   { label: "Relay",   colorClass: "text-chart-4 border-chart-4/30" },
  KEEPER:  { label: "Keeper",  colorClass: "text-chart-3 border-chart-3/30" },
  WRITER:  { label: "Writer",  colorClass: "text-chart-5 border-chart-5/30" },
};

export function AgentTypeBadge({ type }: { type: AgentType }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.CARBON;
  return (
    <span
      className={cn(
        "text-[10px] font-medium border rounded-full px-2 py-0.5",
        cfg.colorClass,
      )}
    >
      {cfg.label}
    </span>
  );
}
