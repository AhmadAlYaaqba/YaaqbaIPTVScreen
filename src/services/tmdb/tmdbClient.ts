import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  TMDB_API_KEY,
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE_URL,
} from '@env';

const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export function isTmdbEnabled(): boolean {
  return Boolean(TMDB_API_KEY?.trim());
}

export function getTmdbImageBaseUrl(): string {
  return TMDB_IMAGE_BASE_URL?.trim() || DEFAULT_IMAGE_BASE_URL;
}

export function getTmdbBaseUrl(): string {
  return TMDB_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryAfterMs(error: AxiosError): number {
  const header = error.response?.headers?.['retry-after'];
  if (header) {
    const seconds = parseInt(String(header), 10);
    if (!Number.isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return 2000;
}

let clientInstance: AxiosInstance | null = null;

export function getTmdbClient(): AxiosInstance | null {
  if (!isTmdbEnabled()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = axios.create({
      baseURL: getTmdbBaseUrl(),
      timeout: 10000,
      params: {
        api_key: TMDB_API_KEY,
      },
    });

    clientInstance.interceptors.response.use(
      response => response,
      async error => {
        const axiosError = error as AxiosError;
        const config = axiosError.config as
          | (typeof axiosError.config & { _retry?: boolean })
          | undefined;

        if (
          axiosError.response?.status === 429 &&
          config &&
          !config._retry
        ) {
          config._retry = true;
          await sleep(getRetryAfterMs(axiosError));
          return clientInstance!.request(config);
        }

        if (__DEV__) {
          const status = axiosError.response?.status;
          const message = axiosError.message;
          console.warn(
            `[TMDB] Request failed${status ? ` (${status})` : ''}: ${message}`,
          );
        }

        return Promise.reject(error);
      },
    );
  }

  return clientInstance;
}

export async function tmdbGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T | null> {
  const client = getTmdbClient();
  if (!client) {
    return null;
  }

  try {
    const response = await client.get<T>(path, { params });
    return response.data;
  } catch {
    return null;
  }
}

export type TmdbImageSize =
  | 'w92'
  | 'w154'
  | 'w185'
  | 'w342'
  | 'w500'
  | 'w780'
  | 'original';

export function imageUrl(
  path: string | null | undefined,
  size: TmdbImageSize = 'w500',
): string | undefined {
  if (!path?.trim()) {
    return undefined;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getTmdbImageBaseUrl()}/${size}${normalized}`;
}
