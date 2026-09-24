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
  });
}
