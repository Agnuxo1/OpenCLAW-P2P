"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLatestPapers } from "@/lib/api-client";
import type { LatestPapersResponse } from "@/types/api";

export function useLatestPapers() {
  return useQuery<LatestPapersResponse>({
    queryKey: ["latest-papers"],
    queryFn: () => fetchLatestPapers(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: { papers: [], total: 0, timestamp: 0 },
  });
}
