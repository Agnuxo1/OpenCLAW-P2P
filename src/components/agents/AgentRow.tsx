"use client";

import type { Agent } from "@/types/api";
import { RankBadge } from "./RankBadge";
import { AgentTypeBadge } from "./AgentTypeBadge";
import { cn } from "@/lib/utils";
import { Cpu, FileText, CheckSquare, Clock } from "lucide-react";

interface AgentRowProps {
  agent: Agent;
  rank?: number;
}

function timeSince(ts: number): string {
  if (!ts) return "never";
  const d = Date.now() - ts;
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
  return `${Math.floor(d / 86400_000)}d ago`;
}

export function AgentRow({ agent, rank }: AgentRowProps) {
  const isActive = agent.status === "ACTIVE";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1c]",
        "hover:bg-[#0c0c0d] transition-colors",
      )}
    >
      {/* Rank number */}
      {rank !== undefined && (
        <span className="font-mono text-xs text-[#2c2c30] w-6 text-right shrink-0">
          #{rank}
        </span>
      )}

      {/* Status dot */}
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          isActive ? "bg-green-500 blink" : "bg-[#2c2c30]",
        )}
        title={agent.status}
      />

      {/* Agent icon */}
      <div className="w-8 h-8 rounded bg-[#1a1a1c] flex items-center justify-center shrink-0">
        <Cpu className={`w-4 h-4 ${isActive ? "text-[#ff4e1a]" : "text-[#52504e]"}`} />
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-[#f5f0eb] truncate">
            {agent.name}
          </span>
          <RankBadge rank={agent.rank} size="xs" />
          <AgentTypeBadge type={agent.type} />
        </div>
        {agent.id && (
          <span className="font-mono text-[10px] text-[#2c2c30] truncate">
            {agent.id}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-6 shrink-0">
        <span
          className="flex items-center gap-1 font-mono text-xs text-[#52504e]"
          title="Papers published"
        >
          <FileText className="w-3 h-3" />
          {agent.papersPublished ?? 0}
        </span>
        <span
          className="flex items-center gap-1 font-mono text-xs text-[#52504e]"
          title="Validations cast"
        >
          <CheckSquare className="w-3 h-3" />
          {agent.validations ?? 0}
        </span>
        <span
          className="flex items-center gap-1 font-mono text-xs text-[#52504e]"
          title="Last heartbeat"
        >
          <Clock className="w-3 h-3" />
          {timeSince(agent.lastHeartbeat)}
        </span>
      </div>

      {/* Score */}
      <div className="text-right shrink-0">
        <span className="font-mono text-sm font-bold text-[#ff4e1a]">
          {(agent.score ?? 0).toLocaleString()}
        </span>
        <span className="block font-mono text-[9px] text-[#2c2c30]">SCORE</span>
      </div>
    </div>
  );
}
