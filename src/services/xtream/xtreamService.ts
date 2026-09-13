import axios from 'axios';

import { proxyApiUrl } from '../../utils/proxy';
import { buildPlayerApiUrl, XTREAM_REQUEST_HEADERS } from '../../utils/xtream';

export type XtreamMediaType = 'live' | 'movie' | 'series';

export interface XtreamConnection {
  username: string;
  password: string;
  domain: string;
  port: string;
  useProxy: boolean;
}

export interface XtreamSession extends XtreamConnection {
  playlistId: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id?: string | number;
  [key: string]: unknown;
}

export interface XtreamLiveStream {
  stream_id: number;
  name: string;
  num?: number;
  container_extension?: string;
  stream_icon?: string;
  icon?: string;
  epg_channel_id?: string;
  [key: string]: unknown;
}

export interface XtreamMovieStream {
  stream_id: number;
  name: string;
  stream_icon?: string;
  container_extension?: string;
  rating?: string | number;
  year?: string | number;
  [key: string]: unknown;
}

export interface XtreamSeriesItem {
  series_id: string;
  name: string;
  cover?: string;
  rating?: string | number;
  rating_5based?: string | number;
  year?: string | number;
  releaseDate?: string;
  release_date?: string;
  [key: string]: unknown;
}

export interface XtreamEpisode {
  id: string | number;
  title?: string;
  episode_num?: number;
  episode?: number;
  container_extension?: string;
  info?: Record<string, any>;
  [key: string]: unknown;
}

export interface XtreamSeriesDetails {
  info?: Record<string, any>;
  episodes?: Record<string, XtreamEpisode[]>;
  seasons?: unknown[];
  [key: string]: unknown;
}

export interface XtreamAccountInfo {
  status: string;
  isTrial: boolean;
  expiresAt?: number;
  createdAt?: number;
  activeConnections?: number;
  maxConnections?: number;
  planName?: string;
  allowedOutputFormats: string[];
}

export type XtreamContentByMedia = {
  live: XtreamLiveStream;
  movie: XtreamMovieStream;
  series: XtreamSeriesItem;
};

const CATEGORY_ACTIONS: Record<XtreamMediaType, string> = {
  live: 'get_live_categories',
  movie: 'get_vod_categories',
  series: 'get_series_categories',
};

const CONTENT_ACTIONS: Record<XtreamMediaType, string> = {
  live: 'get_live_streams',
  movie: 'get_vod_streams',
  series: 'get_series',
};

interface XtreamRequestOptions {
  action: string;
  extraParams?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
}

export async function requestXtream<T>(
  connection: XtreamConnection,
  { action, extraParams, signal }: XtreamRequestOptions,
): Promise<T> {
  const originalUrl = buildPlayerApiUrl({
    username: connection.username,
    password: connection.password,
    domain: connection.domain,
    port: connection.port,
    action,
    extraParams,
  });
  const requestUrl = proxyApiUrl(originalUrl, connection.useProxy);

  try {
    const response = await axios.get<T>(requestUrl, {
      headers: XTREAM_REQUEST_HEADERS,
      timeout: 15000,
      signal,
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || signal?.aborted) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        status
          ? `Xtream request failed (${action}): HTTP ${status}`
          : `Xtream request failed (${action}): ${error.message}`,
      );
    }
    throw error;
  }
}

export async function getXtreamCategories(
  connection: XtreamConnection,
  mediaType: XtreamMediaType,
  signal?: AbortSignal,
): Promise<XtreamCategory[]> {
  const data = await requestXtream<unknown>(connection, {
    action: CATEGORY_ACTIONS[mediaType],
    signal,
  });
  return Array.isArray(data) ? (data as XtreamCategory[]) : [];
}

export async function getXtreamCategoryContent<M extends XtreamMediaType>(
  connection: XtreamConnection,
  mediaType: M,
  categoryId: string,
  signal?: AbortSignal,
): Promise<XtreamContentByMedia[M][]> {
  const data = await requestXtream<unknown>(connection, {
    action: CONTENT_ACTIONS[mediaType],
    extraParams: { category_id: categoryId },
    signal,
  });
  return Array.isArray(data) ? (data as XtreamContentByMedia[M][]) : [];
}

export async function getXtreamSeriesDetails(
  connection: XtreamConnection,
  seriesId: string,
  signal?: AbortSignal,
): Promise<XtreamSeriesDetails> {
  const data = await requestXtream<unknown>(connection, {
    action: 'get_series_info',
    extraParams: { series_id: seriesId },
    signal,
  });
  return data && typeof data === 'object'
    ? (data as XtreamSeriesDetails)
    : { info: {}, episodes: {} };
}

function optionalAccountString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalAccountNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getXtreamAccountInfo(
  connection: XtreamConnection,
  signal?: AbortSignal,
): Promise<XtreamAccountInfo> {
  const data = await requestXtream<unknown>(connection, {
    action: '',
    signal,
  });
  const response =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const raw =
    response?.user_info && typeof response.user_info === 'object'
      ? (response.user_info as Record<string, unknown>)
      : null;

  if (!raw) {
    throw new Error('Xtream account response did not include user information');
  }

  const planName = [
    raw.plan_name,
    raw.package_name,
    raw.subscription_name,
    raw.bouquet_name,
    raw.package,
  ]
    .map(optionalAccountString)
    .find(Boolean);
  const formats = Array.isArray(raw.allowed_output_formats)
    ? raw.allowed_output_formats
        .map(optionalAccountString)
        .filter((value): value is string => Boolean(value))
    : [];

  return {
    status: optionalAccountString(raw.status)?.toLowerCase() || 'active',
    isTrial: raw.is_trial === true || String(raw.is_trial) === '1',
    expiresAt: optionalAccountNumber(raw.exp_date),
    createdAt: optionalAccountNumber(raw.created_at),
    activeConnections: optionalAccountNumber(raw.active_cons),
    maxConnections: optionalAccountNumber(raw.max_connections),
    planName,
    allowedOutputFormats: formats,
  };
}
