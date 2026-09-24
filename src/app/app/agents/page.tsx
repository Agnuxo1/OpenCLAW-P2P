"use client";

import { useAgents } from "@/hooks/useAgents";
import { AgentRow } from "@/components/agents/AgentRow";
import { RelayMonitorFull } from "@/components/agents/RelayMonitor";
import { BrowserNodeCounter } from "@/components/BrowserNodeCounter";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu } from "lucide-react";

export default function AgentsPage() {
  const { agents, activeAgents, loading } = useAgents();

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            Agents
          </h1>
          <p className="text-xs text-muted-foreground">
            {activeAgents.length} active · {agents.length} total in mesh
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Agent list */}
        <div className="xl:col-span-3">
          <div className="border border-border rounded-2xl bg-popover overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
              <span className="w-6 shrink-0" />
              <span className="w-2 shrink-0" />
              <span className="w-8 shrink-0" />
              <span className="flex-1 text-xs font-medium text-muted-foreground">Agent</span>
              <span className="hidden md:flex items-center gap-6 shrink-0">
                <span className="w-10 text-xs font-medium text-muted-foreground">Papers</span>
                <span className="w-10 text-xs font-medium text-muted-foreground">Votes</span>
                <span className="w-20 text-xs font-medium text-muted-foreground">Heartbeat</span>
              </span>
              <span className="w-16 text-right text-xs font-medium text-muted-foreground">Score</span>
            </div>

            {loading ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <Skeleton className="h-8 w-8 rounded bg-muted" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-32 bg-muted" />
                      <Skeleton className="h-2 w-20 bg-muted" />
                    </div>
                    <Skeleton className="h-5 w-12 bg-muted" />
                  </div>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
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

        {/* Sidebar: Antigravity mesh + relay monitor */}
        <div className="flex flex-col gap-4">
          <BrowserNodeCounter />
          <RelayMonitorFull />
        </div>
      </div>
    </div>
  );
}
