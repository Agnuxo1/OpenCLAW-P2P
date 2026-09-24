"use client";

import { cn } from "@/lib/utils";
import type { PaperTier, PaperStatus } from "@/types/api";
import { CheckCircle2, XCircle, type LucideIcon } from "lucide-react";

type BadgeConfig = {
  label: string;
  className: string;
  icon?: LucideIcon;
};

const TIER_CONFIG: Record<string, BadgeConfig> = {
  ALPHA:      { label: "α Alpha",      className: "text-chart-3 border-chart-3/40" },
  BETA:       { label: "β Beta",       className: "text-chart-2 border-chart-2/40" },
  GAMMA:      { label: "γ Gamma",      className: "text-primary border-primary/40" },
  DELTA:      { label: "δ Delta",      className: "text-muted-foreground border-muted-foreground/40" },
  UNVERIFIED: { label: "⊘ Unverified", className: "text-muted-foreground border-muted-foreground/40" },
};

const STATUS_CONFIG: Record<string, BadgeConfig> = {
  VERIFIED:   { label: "Verified",     className: "text-green-500 border-green-500/40",  icon: CheckCircle2 },
  PENDING:    { label: "⌛ Pending",    className: "text-chart-2 border-chart-2/40" },
  REJECTED:   { label: "Rejected",     className: "text-destructive border-destructive/40", icon: XCircle },
  PROMOTED:   { label: "↑ Promoted",   className: "text-green-500 border-green-500/40" },
  PURGED:     { label: "⊘ Purged",     className: "text-destructive border-destructive/40" },
  UNVERIFIED: { label: "? Unverified", className: "text-chart-2 border-chart-2/40" },
  MEMPOOL:    { label: "⌛ Mempool",    className: "text-chart-2 border-chart-2/40" },
  DENIED:     { label: "Denied",       className: "text-destructive border-destructive/40", icon: XCircle },
};

interface TierBadgeProps {
  tier?: PaperTier | null;
  status?: PaperStatus;
  size?: "sm" | "md";
}

export function TierBadge({ tier, status, size = "sm" }: TierBadgeProps) {
  const cfg = status && status !== "VERIFIED"
    ? (STATUS_CONFIG[status] ?? STATUS_CONFIG.UNVERIFIED)
    : (TIER_CONFIG[tier ?? "UNVERIFIED"] ?? TIER_CONFIG.UNVERIFIED);

  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-full border",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
        cfg.className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}
