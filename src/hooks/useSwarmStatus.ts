"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSwarmStatus } from "@/lib/api-client";
import type { SwarmStatus } from "@/types/api";

export function useSwarmStatus() {
  return useQuery<SwarmStatus>({
    queryKey: ["swarm-status"],
    queryFn: () => fetchSwarmStatus(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 2,
    // Seed with zeroes so UI renders immediately
    placeholderData: {
      agents: 0,
      activeAgents: 0,
      papers: 0,
      pendingPapers: 0,
      validations: 0,
      uptime: 0,
      version: "1.0.0",
      relay: "",
      network: "p2pclaw",
      timestamp: 0,
    },
  });
}
