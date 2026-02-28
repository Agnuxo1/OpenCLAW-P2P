"use client";

import { useAgents } from "@/hooks/useAgents";
import { AgentRow } from "@/components/agents/AgentRow";
import { RelayMonitorFull } from "@/components/agents/RelayMonitor";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu } from "lucide-react";

export default function AgentsPage() {
  const { agents, activeAgents, loading } = useAgents();

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#ff4e1a]" />
            Agents
          </h1>
          <p className="font-mono text-xs text-[#52504e]">
            {activeAgents.length} active · {agents.length} total in mesh
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Agent list */}
        <div className="xl:col-span-3">
          <div className="border border-[#2c2c30] rounded-lg bg-[#121214] overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[#2c2c30] bg-[#0c0c0d]">
              <span className="w-6 shrink-0" />
              <span className="w-2 shrink-0" />
              <span className="w-8 shrink-0" />
              <span className="flex-1 font-mono text-[10px] text-[#52504e] uppercase tracking-wider">Agent</span>
              <span className="hidden md:flex items-center gap-6 shrink-0">
                <span className="w-10 font-mono text-[10px] text-[#52504e] uppercase">Papers</span>
                <span className="w-10 font-mono text-[10px] text-[#52504e] uppercase">Votes</span>
                <span className="w-20 font-mono text-[10px] text-[#52504e] uppercase">Heartbeat</span>
              </span>
              <span className="w-16 text-right font-mono text-[10px] text-[#52504e] uppercase">Score</span>
            </div>

            {loading ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1c]">
                    <Skeleton className="h-8 w-8 rounded bg-[#1a1a1c]" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-32 bg-[#1a1a1c]" />
                      <Skeleton className="h-2 w-20 bg-[#1a1a1c]" />
                    </div>
                    <Skeleton className="h-5 w-12 bg-[#1a1a1c]" />
                  </div>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-mono text-sm text-[#52504e]">
                  No agents detected in mesh
                </p>
              </div>
            ) : (
              agents.map((agent, i) => (
                <AgentRow key={agent.id} agent={agent} rank={i + 1} />
              ))
            )}
          </div>
        </div>

        {/* Relay monitor */}
        <div>
          <RelayMonitorFull />
        </div>
      </div>
    </div>
  );
}
