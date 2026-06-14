import {
  CastMember,
  MediaDetails,
  MediaItem,
  MediaType,
  SeasonEpisode,
} from '../../types/media';
import { normalizeTitle } from '../../utils/titleNormalize';
import { pickBestMatch } from './match';
import {
  buildDetailsCacheKey,
  buildSearchCacheKey,
  buildSeasonCacheKey,
  tmdbCache,
} from './tmdbCache';
import { imageUrl, isTmdbEnabled, tmdbGet } from './tmdbClient';

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
}

interface TmdbCredits {
  cast?: TmdbCastMember[];
}

interface TmdbImages {
  logos?: Array<{ file_path?: string | null }>;
}

interface TmdbMovieResult {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  genre_ids?: number[];
  popularity?: number;
}

interface TmdbTvResult {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  first_air_date?: string;
  genre_ids?: number[];
  popularity?: number;
}

interface TmdbSearchResponse<T> {
  results?: T[];
}

interface TmdbMovieDetails extends TmdbMovieResult {
  tagline?: string;
  runtime?: number;
  genres?: TmdbGenre[];
  credits?: TmdbCredits;
  images?: TmdbImages;
}

interface TmdbTvDetails extends TmdbTvResult {
  tagline?: string;
  episode_run_time?: number[];
  genres?: TmdbGenre[];
  credits?: TmdbCredits;
  images?: TmdbImages;
}

interface TmdbSeasonEpisode {
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  air_date?: string;
  vote_average?: number;
}

interface TmdbSeasonResponse {
  episodes?: TmdbSeasonEpisode[];
}

function mapCast(cast?: TmdbCastMember[]): CastMember[] {
  if (!cast?.length) {
    return [];
  }

  return cast.slice(0, 15).map(member => ({
    id: String(member.id),
    name: member.name,
    character: member.character,
    profile: imageUrl(member.profile_path, 'w185'),
  }));
}

function mapGenres(genres?: TmdbGenre[]): string[] | undefined {
  const names = genres?.map(genre => genre.name).filter(Boolean);
  return names?.length ? names : undefined;
}

function mapMovieResult(result: TmdbMovieResult, type: MediaType = 'movie'): MediaItem {
  return {
    id: String(result.id),
    title: result.title || result.original_title || 'Unknown',
    originalTitle: result.original_title,
    overview: result.overview || undefined,
    poster: imageUrl(result.poster_path, 'w342'),
    backdrop: imageUrl(result.backdrop_path, 'w780'),
    rating:
      typeof result.vote_average === 'number' && result.vote_average > 0
        ? result.vote_average
        : undefined,
    releaseDate: result.release_date || undefined,
    type,
  };
}

function mapTvResult(result: TmdbTvResult, type: MediaType = 'series'): MediaItem {
  return {
    id: String(result.id),
    title: result.name || result.original_name || 'Unknown',
    originalTitle: result.original_name,
    overview: result.overview || undefined,
    poster: imageUrl(result.poster_path, 'w342'),
    backdrop: imageUrl(result.backdrop_path, 'w780'),
    rating:
      typeof result.vote_average === 'number' && result.vote_average > 0
        ? result.vote_average
        : undefined,
    releaseDate: result.first_air_date || undefined,
    type,
  };
}

function mapMovieDetails(data: TmdbMovieDetails): MediaDetails {
  const base = mapMovieResult(data, 'movie');
  return {
    ...base,
    genres: mapGenres(data.genres),
    tagline: data.tagline || undefined,
    runtime: data.runtime || undefined,
    cast: mapCast(data.credits?.cast),
    logos: data.images?.logos
      ?.map(logo => imageUrl(logo.file_path, 'w500'))
      .filter((url): url is string => Boolean(url)),
  };
}

function mapTvDetails(data: TmdbTvDetails): MediaDetails {
  const base = mapTvResult(data, 'series');
  return {
    ...base,
    genres: mapGenres(data.genres),
    tagline: data.tagline || undefined,
    runtime: data.episode_run_time?.[0] || undefined,
    cast: mapCast(data.credits?.cast),
    logos: data.images?.logos
      ?.map(logo => imageUrl(logo.file_path, 'w500'))
      .filter((url): url is string => Boolean(url)),
  };
}

function mapSeasonEpisodes(data: TmdbSeasonResponse): SeasonEpisode[] {
  return (data.episodes ?? []).map(episode => ({
    episodeNumber: episode.episode_number,
    title: episode.name,
    overview: episode.overview || undefined,
    still: imageUrl(episode.still_path, 'w342'),
    airDate: episode.air_date || undefined,
    rating:
      typeof episode.vote_average === 'number' && episode.vote_average > 0
        ? episode.vote_average
        : undefined,
  }));
}

async function searchByType(
  type: 'movie' | 'series',
  query: string,
  year?: number,
): Promise<MediaItem | null> {
  if (!isTmdbEnabled() || !query.trim()) {
    return null;
  }

  const cacheKey = buildSearchCacheKey(type, query, year);
  return tmdbCache.getOrFetch(cacheKey, async () => {
    const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
    const response = await tmdbGet<TmdbSearchResponse<TmdbMovieResult | TmdbTvResult>>(
      endpoint,
      {
        query,
        year: year || undefined,
        include_adult: false,
      },
    );

    const results = response?.results ?? [];
    const match = pickBestMatch(results, query, year);
    if (!match) {
      return null;
    }

    return type === 'movie'
      ? mapMovieResult(match as TmdbMovieResult)
      : mapTvResult(match as TmdbTvResult);
  }, { allowNull: true });
}

export async function searchMovie(
  rawTitle: string,
  explicitYear?: number,
): Promise<MediaItem | null> {
  const { query, year } = normalizeTitle(rawTitle);
  if (!query) {
    return null;
  }
  return searchByType('movie', query, explicitYear ?? year);
}

export async function searchTv(
  rawTitle: string,
  explicitYear?: number,
): Promise<MediaItem | null> {
  const { query, year } = normalizeTitle(rawTitle);
  if (!query) {
    return null;
  }
  return searchByType('series', query, explicitYear ?? year);
}

export async function getMovieDetails(id: string): Promise<MediaDetails | null> {
  if (!isTmdbEnabled() || !id) {
    return null;
  }

  const cacheKey = buildDetailsCacheKey('movie', id);
  return tmdbCache.getOrFetch(cacheKey, async () => {
    const data = await tmdbGet<TmdbMovieDetails>(`/movie/${id}`, {
      append_to_response: 'credits,images',
    });
    return data ? mapMovieDetails(data) : null;
  }, { allowNull: true });
}

export async function getTvDetails(id: string): Promise<MediaDetails | null> {
  if (!isTmdbEnabled() || !id) {
    return null;
  }

  const cacheKey = buildDetailsCacheKey('series', id);
  return tmdbCache.getOrFetch(cacheKey, async () => {
    const data = await tmdbGet<TmdbTvDetails>(`/tv/${id}`, {
      append_to_response: 'credits,images',
    });
    return data ? mapTvDetails(data) : null;
  }, { allowNull: true });
}

export async function getSeasonEpisodes(
  tvId: string,
  season: number,
): Promise<SeasonEpisode[] | null> {
  if (!isTmdbEnabled() || !tvId || !season) {
    return null;
  }

  const cacheKey = buildSeasonCacheKey(tvId, season);
  return tmdbCache.getOrFetch(cacheKey, async () => {
    const data = await tmdbGet<TmdbSeasonResponse>(
      `/tv/${tvId}/season/${season}`,
    );
    return data ? mapSeasonEpisodes(data) : null;
  }, { allowNull: true });
}

export async function getTrending(
  mediaType: 'movie' | 'tv' = 'movie',
): Promise<MediaItem[]> {
  if (!isTmdbEnabled()) {
    return [];
  }

  const cacheKey = `trending:${mediaType}`;
  const cached = await tmdbCache.getOrFetch(cacheKey, async () => {
    const data = await tmdbGet<TmdbSearchResponse<TmdbMovieResult | TmdbTvResult>>(
      `/trending/${mediaType}/week`,
    );
    const results = data?.results ?? [];
    return results
      .slice(0, 20)
      .map(result =>
        mediaType === 'movie'
          ? mapMovieResult(result as TmdbMovieResult)
          : mapTvResult(result as TmdbTvResult),
      );
  });

  return cached ?? [];
}

export async function getPopularMovies(): Promise<MediaItem[]> {
  if (!isTmdbEnabled()) {
    return [];
  }

  const cacheKey = 'popular:movie';
  const cached = await tmdbCache.getOrFetch(cacheKey, async () => {
    const data = await tmdbGet<TmdbSearchResponse<TmdbMovieResult>>(
      '/movie/popular',
    );
    return (data?.results ?? [])
      .slice(0, 20)
      .map(result => mapMovieResult(result));
  });

  return cached ?? [];
}

export async function getPopularTv(): Promise<MediaItem[]> {
  if (!isTmdbEnabled()) {
    return [];
  }

  const cacheKey = 'popular:tv';
  const cached = await tmdbCache.getOrFetch(cacheKey, async () => {
    const data = await tmdbGet<TmdbSearchResponse<TmdbTvResult>>('/tv/popular');
    return (data?.results ?? [])
      .slice(0, 20)
      .map(result => mapTvResult(result));
  });

  return cached ?? [];
}

export { imageUrl, isTmdbEnabled } from './tmdbClient';
