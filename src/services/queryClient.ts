import { QueryClient } from '@tanstack/react-query';

export const TMDB_QUERY_STALE_TIME_MS = 24 * 60 * 60 * 1000;
export const TMDB_QUERY_GC_TIME_MS = 30 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: TMDB_QUERY_STALE_TIME_MS,
      gcTime: TMDB_QUERY_GC_TIME_MS,
      retry: 1,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
});
