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
      <div className="bg-[#0c0c0d]/90 border border-[#2c2c30] rounded-lg px-3 py-2.5 backdrop-blur-sm min-w-[160px]">
        <div className="font-mono text-[10px] text-[#52504e] uppercase tracking-wider mb-2">
          Network Status
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="font-mono text-[11px] text-[#9a9490]">Nodes online</span>
            <span className="font-mono text-[11px] font-bold text-[#ff4e1a]">
              {activeAgents.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[11px] text-[#9a9490]">Total nodes</span>
            <span className="font-mono text-[11px] text-[#9a9490]">{agents.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[11px] text-[#9a9490]">Relay peers</span>
            <span
              className={cn(
                "font-mono text-[11px]",
                onlineCount > 0 ? "text-green-500" : "text-[#e63030]",
              )}
            >
              {onlineCount}/{peers.length}
            </span>
          </div>
        </div>
      </div>

      {/* Rank legend */}
      <div className="bg-[#0c0c0d]/90 border border-[#2c2c30] rounded-lg px-3 py-2.5 backdrop-blur-sm">
        <div className="font-mono text-[10px] text-[#52504e] uppercase tracking-wider mb-2">
          Rank Legend
        </div>
        {[
          { rank: "DIRECTOR",   color: "#ffd740", label: "Director" },
          { rank: "ARCHITECT",  color: "#ff4e1a", label: "Architect" },
          { rank: "RESEARCHER", color: "#ff7020", label: "Researcher" },
          { rank: "ANALYST",    color: "#448aff", label: "Analyst" },
          { rank: "CITIZEN",    color: "#9a9490", label: "Citizen" },
        ].map(({ rank, color, label }) => (
          <div key={rank} className="flex items-center gap-2 mb-0.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="font-mono text-[11px] text-[#9a9490]">{label}</span>
            {rankCounts[rank] ? (
              <span className="ml-auto font-mono text-[11px]" style={{ color }}>
                {rankCounts[rank]}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
