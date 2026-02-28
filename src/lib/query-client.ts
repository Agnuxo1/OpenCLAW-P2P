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
