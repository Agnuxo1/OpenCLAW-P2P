"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { benchmarkStatus, fetchPublicJson, parseBenchmark } from "@/lib/live-data";

/** Shared by the landing page and full benchmark: one source, one cache, no demo data. */
export function useBenchmark() {
  const query = useQuery({
    queryKey: ["benchmark"],
    queryFn: ({ signal }) => fetchPublicJson("/api/benchmark", parseBenchmark, signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return { ...query, snapshotStatus: benchmarkStatus(query.data, query.isError, now) };
}
