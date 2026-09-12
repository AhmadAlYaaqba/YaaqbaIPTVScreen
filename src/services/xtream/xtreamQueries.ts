import { useQuery } from '@tanstack/react-query';

import {
  getXtreamCategories,
  getXtreamCategoryContent,
  getXtreamSeriesDetails,
  XtreamContentByMedia,
  XtreamMediaType,
  XtreamSession,
} from './xtreamService';

export const XTREAM_CATEGORY_STALE_TIME_MS = 12 * 60 * 60 * 1000;
export const XTREAM_CONTENT_STALE_TIME_MS = 30 * 60 * 1000;
export const XTREAM_SERIES_DETAILS_STALE_TIME_MS = 60 * 60 * 1000;
export const XTREAM_CACHE_GC_TIME_MS = 24 * 60 * 60 * 1000;

export const xtreamQueryKeys = {
  all: ['xtream'] as const,
  playlist: (playlistId: string) => ['xtream', playlistId] as const,
  categories: (playlistId: string, mediaType: XtreamMediaType) =>
    ['xtream', playlistId, mediaType, 'categories'] as const,
  categoryContent: (
    playlistId: string,
    mediaType: XtreamMediaType,
    categoryId: string,
  ) => ['xtream', playlistId, mediaType, 'category', categoryId] as const,
  seriesDetails: (playlistId: string, seriesId: string) =>
    ['xtream', playlistId, 'series', 'details', seriesId] as const,
};

function isSessionReady(session: XtreamSession | null): session is XtreamSession {
  return Boolean(
    session?.playlistId &&
      session.username &&
      session.password &&
      session.domain &&
      session.port,
  );
}

export function useXtreamCategories(
  session: XtreamSession | null,
  mediaType: XtreamMediaType,
) {
  const playlistId = session?.playlistId ?? 'no-playlist';
  return useQuery({
    queryKey: xtreamQueryKeys.categories(playlistId, mediaType),
    queryFn: ({ signal }) => getXtreamCategories(session!, mediaType, signal),
    enabled: isSessionReady(session),
    staleTime: XTREAM_CATEGORY_STALE_TIME_MS,
    gcTime: XTREAM_CACHE_GC_TIME_MS,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

export function useXtreamCategoryContent<M extends XtreamMediaType>(
  session: XtreamSession | null,
  mediaType: M,
  categoryId: string | null,
) {
  const playlistId = session?.playlistId ?? 'no-playlist';
  return useQuery<XtreamContentByMedia[M][]>({
    queryKey: xtreamQueryKeys.categoryContent(
      playlistId,
      mediaType,
      categoryId ?? 'no-category',
    ),
    queryFn: ({ signal }) =>
      getXtreamCategoryContent(session!, mediaType, categoryId!, signal),
    enabled: isSessionReady(session) && Boolean(categoryId),
    staleTime: XTREAM_CONTENT_STALE_TIME_MS,
    gcTime: XTREAM_CACHE_GC_TIME_MS,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

export function useXtreamSeriesDetails(
  session: XtreamSession | null,
  seriesId: string,
) {
  const playlistId = session?.playlistId ?? 'no-playlist';
  return useQuery({
    queryKey: xtreamQueryKeys.seriesDetails(playlistId, seriesId),
    queryFn: ({ signal }) => getXtreamSeriesDetails(session!, seriesId, signal),
    enabled: isSessionReady(session) && Boolean(seriesId),
    staleTime: XTREAM_SERIES_DETAILS_STALE_TIME_MS,
    gcTime: XTREAM_CACHE_GC_TIME_MS,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

export function getXtreamErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : error ? String(error) : null;
}
