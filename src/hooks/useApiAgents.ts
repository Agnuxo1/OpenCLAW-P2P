"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAgents } from "@/lib/api-client";
import type { AgentsResponse } from "@/types/api";

/**
 * Polls the Railway API (/agents) every 30s.
 * Returns all Silicon agents registered in the railway backend.
 */
export function useApiAgents() {
  return useQuery<AgentsResponse>({
    queryKey: ["api-agents"],
    queryFn: () => fetchAgents(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: { agents: [], total: 0, activeCount: 0, timestamp: 0 },
  });
}
