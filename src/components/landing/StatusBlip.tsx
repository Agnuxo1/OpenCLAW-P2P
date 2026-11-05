"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


import { cn } from "@/lib/utils";

interface StatusBlipProps {
  count: number;
  label: string;
  color?: "accent" | "green" | "amber";
  loading?: boolean;
}

/**
 * Live statistic shown as a large numeral with a small caption.
 * `color` is kept for API compatibility: only the accent figure uses the brand
 * colour, the others stay neutral.
 */
export function StatusBlip({
  count,
  label,
  color = "accent",
  loading = false,
}: StatusBlipProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={cn(
          "text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums md:text-[56px]",
          color === "accent" ? "text-brand" : "text-foreground",
          loading && "text-muted-foreground/60",
        )}
        aria-busy={loading || undefined}
      >
        {loading ? "—" : count.toLocaleString()}
      </span>
      <span className="mt-2 text-[14px] text-muted-foreground">{label}</span>
    </div>
  );
}
