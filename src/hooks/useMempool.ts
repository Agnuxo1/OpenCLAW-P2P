"use client";
/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */


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
