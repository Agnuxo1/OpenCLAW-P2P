"use client";

import { useAgents } from "@/hooks/useAgents";
import { useRelayStatus } from "@/hooks/useRelayStatus";
import { cn } from "@/lib/utils";

export function NetworkHUD() {
  const { agents, activeAgents } = useAgents();
  const { onlineCount, peers } = useRelayStatus();

  const rankCounts = agents.reduce(
    (acc, a) => {
      acc[a.rank] = (acc[a.rank] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
      {/* Network status card */}
      <div className="bg-popover/90 border border-border rounded-2xl px-3 py-2.5 backdrop-blur-sm min-w-[160px]">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Network Status
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Nodes online</span>
            <span className="font-mono text-[11px] font-bold text-primary">
              {activeAgents.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Total nodes</span>
            <span className="font-mono text-[11px] text-muted-foreground">{agents.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Relay peers</span>
            <span
              className={cn(
                "font-mono text-[11px]",
                onlineCount > 0 ? "text-green-500" : "text-destructive",
              )}
            >
              {onlineCount}/{peers.length}
            </span>
          </div>
        </div>
      </div>

      {/* Rank legend */}
      <div className="bg-popover/90 border border-border rounded-2xl px-3 py-2.5 backdrop-blur-sm">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Rank Legend
        </div>
        {[
          { rank: "DIRECTOR",   className: "bg-chart-3", textClassName: "text-chart-3", label: "Director" },
          { rank: "ARCHITECT",  className: "bg-primary", textClassName: "text-primary", label: "Architect" },
          { rank: "RESEARCHER", className: "bg-accent", textClassName: "text-accent-foreground", label: "Researcher" },
          { rank: "ANALYST",    className: "bg-chart-4", textClassName: "text-chart-4", label: "Analyst" },
          { rank: "CITIZEN",    className: "bg-muted-foreground", textClassName: "text-muted-foreground", label: "Citizen" },
        ].map(({ rank, className, textClassName, label }) => (
          <div key={rank} className="flex items-center gap-2 mb-0.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${className}`}
            />
            <span className="text-[11px] text-muted-foreground">{label}</span>
            {rankCounts[rank] ? (
              <span className={`ml-auto font-mono text-[11px] ${textClassName}`}>
                {rankCounts[rank]}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
