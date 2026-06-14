import { useEffect, useMemo, useState } from 'react';
import { MediaDetails, MediaItem, MediaType } from '../types/media';
import {
  buildDetailsCacheKey,
  buildSearchCacheKey,
  tmdbCache,
} from '../services/tmdb/tmdbCache';
import {
  getMovieDetails,
  getTvDetails,
  isTmdbEnabled,
  searchMovie,
  searchTv,
} from '../services/tmdb';
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
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = useMemo(() => {
    if (!title?.trim()) {
      return null;
    }
    return getSearchCacheKey(type, title, year);
  }, [title, year, type]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !isTmdbEnabled() || !title?.trim() || !cacheKey) {
      setMedia(null);
      setLoading(false);
      return;
    }

    const syncHit = tmdbCache.getSync<MediaItem | null>(cacheKey);
    if (syncHit !== undefined) {
      setMedia(syncHit);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchMatch = async () => {
      const cached = await tmdbCache.get<MediaItem | null>(cacheKey);
      if (cancelled) {
        return;
      }
      if (cached !== undefined) {
        setMedia(cached);
        setLoading(false);
        return;
      }

      const result =
        type === 'movie'
          ? await searchMovie(title, year)
          : await searchTv(title, year);

      if (!cancelled) {
        setMedia(result);
        setLoading(false);
      }
    };

    fetchMatch();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, title, type, year]);

  return { media, loading };
}

export function useTmdbDetails({
  id,
  type,
  enabled = true,
}: UseTmdbDetailsOptions): UseTmdbDetailsResult {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = useMemo(() => {
    if (!id) {
      return null;
    }
    return buildDetailsCacheKey(type, id);
  }, [id, type]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !isTmdbEnabled() || !id || !cacheKey) {
      setDetails(null);
      setLoading(false);
      return;
    }

    const syncHit = tmdbCache.getSync<MediaDetails | null>(cacheKey);
    if (syncHit !== undefined) {
      setDetails(syncHit);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchDetails = async () => {
      const cached = await tmdbCache.get<MediaDetails | null>(cacheKey);
      if (cancelled) {
        return;
      }
      if (cached !== undefined) {
        setDetails(cached);
        setLoading(false);
        return;
      }

      const result =
        type === 'movie' ? await getMovieDetails(id) : await getTvDetails(id);

      if (!cancelled) {
        setDetails(result);
        setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, id, type]);

  return { details, loading };
}
