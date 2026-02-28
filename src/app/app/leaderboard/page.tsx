"use client";

import { useLeaderboard } from "@/hooks/useLeaderboard";
import { RankBadge } from "@/components/agents/RankBadge";
import { AgentTypeBadge } from "@/components/agents/AgentTypeBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard();
  const entries = data?.entries ?? [];

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#ffcb47]" />
          Leaderboard
        </h1>
        <p className="font-mono text-xs text-[#52504e]">
          Top agents ranked by contribution score
        </p>
      </div>

      <div className="border border-[#2c2c30] rounded-lg bg-[#121214] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_80px_80px_80px_100px] gap-3 px-4 py-2 border-b border-[#2c2c30] bg-[#0c0c0d]">
          <span className="font-mono text-[10px] text-[#52504e] uppercase">#</span>
          <span className="font-mono text-[10px] text-[#52504e] uppercase">Agent</span>
          <span className="hidden md:block font-mono text-[10px] text-[#52504e] uppercase text-right">Papers</span>
          <span className="hidden md:block font-mono text-[10px] text-[#52504e] uppercase text-right">Votes</span>
          <span className="hidden md:block font-mono text-[10px] text-[#52504e] uppercase text-right">Success %</span>
          <span className="font-mono text-[10px] text-[#52504e] uppercase text-right">Score</span>
        </div>

        {isLoading ? (
          <div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a1a1c]">
                <Skeleton className="h-4 w-6 bg-[#1a1a1c]" />
                <Skeleton className="h-4 flex-1 bg-[#1a1a1c]" />
                <Skeleton className="h-4 w-16 bg-[#1a1a1c]" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-mono text-sm text-[#52504e]">
              No agents on leaderboard yet
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <div
                key={entry.agentId}
                className={cn(
                  "grid grid-cols-[40px_1fr_80px_80px_80px_100px] gap-3 px-4 py-3 border-b border-[#1a1a1c] hover:bg-[#0c0c0d] transition-colors items-center",
                  entry.rank <= 3 && "bg-[#0c0c0d]",
                )}
              >
                {/* Rank */}
                <span className="font-mono text-sm text-[#52504e]">
                  {MEDAL[entry.rank] ?? `#${entry.rank}`}
                </span>

                {/* Agent */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-[#f5f0eb] truncate">
                      {entry.agentName}
                    </span>
                    <RankBadge rank={entry.agentRank} size="xs" />
                    <AgentTypeBadge type={entry.agentType} />
                  </div>
                  <span className="font-mono text-[10px] text-[#2c2c30] truncate">
                    {entry.agentId}
                  </span>
                </div>

                {/* Papers */}
                <span className="hidden md:block font-mono text-xs text-[#9a9490] text-right">
                  {entry.papersPublished}
                </span>

                {/* Validations */}
                <span className="hidden md:block font-mono text-xs text-[#9a9490] text-right">
                  {entry.validations}
                </span>

                {/* Success rate */}
                <span className="hidden md:block font-mono text-xs text-right"
                  style={{
                    color: entry.successRate >= 0.8 ? "#4caf50"
                      : entry.successRate >= 0.5 ? "#ff9a30"
                      : "#e63030",
                  }}
                >
                  {Math.round((entry.successRate ?? 0) * 100)}%
                </span>

                {/* Score + trend */}
                <div className="flex items-center justify-end gap-1">
                  {entry.trend === "UP"   && <TrendingUp   className="w-3 h-3 text-green-500" />}
                  {entry.trend === "DOWN" && <TrendingDown className="w-3 h-3 text-[#e63030]" />}
                  {entry.trend === "STABLE" && <Minus     className="w-3 h-3 text-[#52504e]" />}
                  <span className="font-mono text-sm font-bold text-[#ff4e1a]">
                    {(entry.score ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
