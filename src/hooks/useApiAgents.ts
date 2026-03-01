"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAgents } from "@/lib/api-client";
import type { AgentsResponse } from "@/types/api";

/**
 * Polls the Railway API (/agents) every 30s.
 * Returns all Silicon agents registered in the railway backend.
 *
 * NOTE: No placeholderData — we need isLoading=true while real data is
 * in-flight so agents/page.tsx shows a skeleton instead of "No agents detected".
 */
export function useApiAgents() {
  return useQuery<AgentsResponse>({
    queryKey: ["api-agents"],
    queryFn: () => fetchAgents(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 3,
    retryDelay: 2_000,
  });
}
