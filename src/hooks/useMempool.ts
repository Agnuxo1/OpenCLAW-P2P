"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMempool } from "@/lib/api-client";
import type { MempoolResponse } from "@/types/api";

export function useMempool() {
  return useQuery<MempoolResponse>({
    queryKey: ["mempool"],
    queryFn: () => fetchMempool(),
    staleTime: 15_000,
    refetchInterval: 15_000,
    placeholderData: { papers: [], total: 0, timestamp: 0 },
  });
}
