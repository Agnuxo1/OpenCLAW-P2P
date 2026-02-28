"use client";

import { cn } from "@/lib/utils";

interface StatusBlipProps {
  count: number;
  label: string;
  color?: "accent" | "green" | "amber";
  loading?: boolean;
}

export function StatusBlip({
  count,
  label,
  color = "accent",
  loading = false,
}: StatusBlipProps) {
  const dotColor = {
    accent: "bg-[#ff4e1a]",
    green: "bg-green-500",
    amber: "bg-[#ff9a30]",
  }[color];

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("w-2 h-2 rounded-full shrink-0 blink", dotColor)}
      />
      <span className="font-mono text-sm">
        <span
          className={cn(
            "font-bold tabular-nums transition-all",
            color === "accent" ? "text-[#ff4e1a]" : "text-[#f5f0eb]",
            loading && "opacity-50",
          )}
        >
          {loading ? "—" : count.toLocaleString()}
        </span>
        <span className="text-[#9a9490] ml-1.5">{label}</span>
      </span>
    </div>
  );
}
