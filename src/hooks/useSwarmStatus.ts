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
