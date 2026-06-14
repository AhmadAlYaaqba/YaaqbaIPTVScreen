import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MediaDetails,
  MediaItem,
  MediaType,
  SeasonEpisode,
} from '../types/media';
import {
  buildDetailsCacheKey,
  buildSeasonCacheKey,
  buildSearchCacheKey,
  tmdbCache,
} from '../services/tmdb/tmdbCache';
import {
  getMovieDetails,
  getSeasonEpisodes,
  getTvDetails,
  searchMovie,
  searchTv,
} from '../services/tmdb';
import { TMDB_QUERY_STALE_TIME_MS } from '../services/queryClient';
import { normalizeTitle } from '../utils/titleNormalize';

interface UseTmdbMatchOptions {
  title?: string;
  year?: number;
  type: Extract<MediaType, 'movie' | 'series'>;
  enabled?: boolean;
}

interface UseTmdbMatchResult {
  media: MediaItem | null;
  loading: boolean;
}

interface UseTmdbDetailsOptions {
  id?: string | null;
  type: Extract<MediaType, 'movie' | 'series'>;
  enabled?: boolean;
}

interface UseTmdbDetailsResult {
  details: MediaDetails | null;
  loading: boolean;
}

interface UseTmdbSeasonEpisodesOptions {
  tvId?: string | null;
  season?: number | null;
  enabled?: boolean;
}

interface UseTmdbSeasonEpisodesResult {
  episodes: SeasonEpisode[];
  loading: boolean;
}

function getSearchCacheKey(
  type: Extract<MediaType, 'movie' | 'series'>,
  title: string,
  year?: number,
): string {
  const { query, year: normalizedYear } = normalizeTitle(title);
  return buildSearchCacheKey(type, query, year ?? normalizedYear);
}

export function useTmdbMatch({
  title,
  year,
  type,
  enabled = true,
}: UseTmdbMatchOptions): UseTmdbMatchResult {
  const cacheKey = useMemo(() => {
    if (!title?.trim()) {
      return null;
    }
    return getSearchCacheKey(type, title, year);
  }, [title, year, type]);

  const query = useQuery({
    queryKey: ['tmdb', 'match', cacheKey],
    queryFn: () =>
      type === 'movie'
        ? searchMovie(title ?? '', year)
        : searchTv(title ?? '', year),
    enabled: Boolean(enabled && title?.trim() && cacheKey),
    staleTime: TMDB_QUERY_STALE_TIME_MS,
    initialData: () =>
      cacheKey ? tmdbCache.getSync<MediaItem | null>(cacheKey) : undefined,
  });

  return {
    media: query.data ?? null,
    loading: query.isFetching && query.data === undefined,
  };
}

export function useTmdbDetails({
  id,
  type,
  enabled = true,
}: UseTmdbDetailsOptions): UseTmdbDetailsResult {
  const cacheKey = useMemo(() => {
    if (!id) {
      return null;
    }
    return buildDetailsCacheKey(type, id);
  }, [id, type]);

  const query = useQuery({
    queryKey: ['tmdb', 'details', cacheKey],
    queryFn: () =>
      type === 'movie' ? getMovieDetails(id ?? '') : getTvDetails(id ?? ''),
    enabled: Boolean(enabled && id && cacheKey),
    staleTime: TMDB_QUERY_STALE_TIME_MS,
    initialData: () =>
      cacheKey ? tmdbCache.getSync<MediaDetails | null>(cacheKey) : undefined,
  });

  return {
    details: query.data ?? null,
    loading: query.isFetching && query.data === undefined,
  };
}

export function useTmdbSeasonEpisodes({
  tvId,
  season,
  enabled = true,
}: UseTmdbSeasonEpisodesOptions): UseTmdbSeasonEpisodesResult {
  const cacheKey = useMemo(() => {
    if (!tvId || !season) {
      return null;
    }
    return buildSeasonCacheKey(tvId, season);
  }, [tvId, season]);

  const query = useQuery({
    queryKey: ['tmdb', 'season', cacheKey],
    queryFn: () => getSeasonEpisodes(tvId ?? '', season ?? 0),
    enabled: Boolean(enabled && tvId && season && cacheKey),
    staleTime: TMDB_QUERY_STALE_TIME_MS,
    initialData: () =>
      cacheKey ? tmdbCache.getSync<SeasonEpisode[] | null>(cacheKey) : undefined,
  });

  return {
    episodes: query.data ?? [],
    loading: query.isFetching && query.data === undefined,
  };
}
