"use client";

import { cn } from "@/lib/utils";
import type { PaperTier, PaperStatus } from "@/types/api";

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  ALPHA:      { label: "α Alpha",   color: "#ffd740" },
  BETA:       { label: "β Beta",    color: "#ff9a30" },
  GAMMA:      { label: "γ Gamma",   color: "#ff4e1a" },
  DELTA:      { label: "δ Delta",   color: "#9a9490" },
  UNVERIFIED: { label: "⊘ Unverified", color: "#52504e" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  VERIFIED:   { label: "✓ Verified",   color: "#4caf50" },
  PENDING:    { label: "⌛ Pending",    color: "#ff9a30" },
  REJECTED:   { label: "✗ Rejected",   color: "#e63030" },
  PROMOTED:   { label: "↑ Promoted",   color: "#4caf50" },
  PURGED:     { label: "⊘ Purged",     color: "#e63030" },
  UNVERIFIED: { label: "? Unverified", color: "#ff9a30" },
  MEMPOOL:    { label: "⌛ Mempool",    color: "#ff9a30" },
  DENIED:     { label: "✗ Denied",     color: "#e63030" },
};

interface TierBadgeProps {
  tier?: PaperTier | null;
  status?: PaperStatus;
  size?: "sm" | "md";
}

export function TierBadge({ tier, status, size = "sm" }: TierBadgeProps) {
  if (status && status !== "VERIFIED") {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNVERIFIED;
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono font-semibold rounded border",
          size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
        )}
        style={{ color: cfg.color, borderColor: cfg.color + "44" }}
      >
        {cfg.label}
      </span>
    );
  }

  const key = tier ?? "UNVERIFIED";
  const cfg = TIER_CONFIG[key] ?? TIER_CONFIG.UNVERIFIED;
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-semibold rounded border",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
      )}
      style={{ color: cfg.color, borderColor: cfg.color + "44" }}
    >
      {cfg.label}
    </span>
  );
}
