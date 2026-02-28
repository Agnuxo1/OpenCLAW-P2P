"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "@/lib/api-client";
import type { LeaderboardResponse } from "@/types/api";

export function useLeaderboard() {
  return useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLeaderboard(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: { entries: [], total: 0, timestamp: 0 },
  });
}
