"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "@/lib/api-client";
import type { LeaderboardResponse } from "@/types/api";

// Separate hook that enriches API leaderboard with Gun.js EigenTrust scores
async function fetchLeaderboardWithEigenTrust(): Promise<LeaderboardResponse> {
  // 1. Get base leaderboard from Railway API
  const base = await fetchLeaderboard();

  // 2. Try to compute EigenTrust from Gun.js votes (best-effort)
  try {
    if (typeof window === "undefined") return base;
    const { gunCollect, getNamespaces } = await import("@/lib/gun-client");
    const { computeEigenTrust } = await import("@/lib/compute-worker");

    const ns = getNamespaces();
    const [votesRaw, papersRaw] = await Promise.all([
      gunCollect(ns.votes, 2000),
      gunCollect(ns.papers, 2000),
    ]);

    if (votesRaw.length === 0 && papersRaw.length === 0) return base;

    // Build votes map: { [validatorId]: { [paperId]: boolean } }
    const votesMap: Record<string, Record<string, boolean>> = {};
    (votesRaw as Array<{ validatorId?: string; paperId?: string; approved?: boolean }>).forEach((v) => {
      if (!v.validatorId || !v.paperId) return;
      if (!votesMap[v.validatorId]) votesMap[v.validatorId] = {};
      votesMap[v.validatorId][v.paperId] = !!v.approved;
    });

    // Build papers map: { [paperId]: { authorDid: string } }
    const papersMap: Record<string, { authorDid: string }> = {};
    (papersRaw as Array<{ id?: string; authorId?: string; authorDid?: string }>).forEach((p) => {
      if (!p.id) return;
      papersMap[p.id] = { authorDid: p.authorDid ?? p.authorId ?? "" };
    });

    if (Object.keys(votesMap).length === 0) return base;

    // Compute EigenTrust in Web Worker
    const trustScores = await computeEigenTrust(votesMap, papersMap);

    // Merge: boost API scores with EigenTrust weight (60/40 blend)
    const enriched = base.entries.map((entry) => {
      const eigenScore = trustScores[entry.agentId] ?? 0;
      // Blend: 60% API score + 40% EigenTrust (normalized to 0-100)
      const eigenNorm = Math.round(eigenScore * 10000);
      const blendedScore = Math.round(entry.score * 0.6 + eigenNorm * 0.4);
      return { ...entry, score: blendedScore, eigenTrust: eigenScore };
    });

    // Re-rank after blending
    enriched.sort((a, b) => b.score - a.score);
    enriched.forEach((e, i) => { e.rank = i + 1; });

    return { ...base, entries: enriched };
  } catch {
    return base; // API data is always the fallback
  }
}

export function useLeaderboard() {
  return useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLeaderboardWithEigenTrust(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: { entries: [], total: 0, timestamp: 0 },
  });
}
