/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */

import { QueryClient } from "@tanstack/react-query";

let _queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!_queryClient) {
    _queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Stale after 30s by default
          staleTime: 30_000,
          // Retry once on failure
          retry: 1,
          // Don't refetch on window focus in this app (Gun handles live data)
          refetchOnWindowFocus: false,
        },
      },
    });
  }
  return _queryClient;
}
