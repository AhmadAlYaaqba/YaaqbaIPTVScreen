import axios, { AxiosError, AxiosInstance } from 'axios';
import { getStoredTmdbApiKey } from './tmdbSettings';

// Inlined at bundle time by babel-preset-expo from .env (EXPO_PUBLIC_ prefix).
// react-native-dotenv was removed: its Babel transform broke
// react-native-worklets shared-value serialization (reanimated #9023).
const TMDB_BASE_URL = process.env.EXPO_PUBLIC_TMDB_BASE_URL;
const TMDB_IMAGE_BASE_URL = process.env.EXPO_PUBLIC_TMDB_IMAGE_BASE_URL;

const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export async function isTmdbEnabled(): Promise<boolean> {
  return Boolean((await getStoredTmdbApiKey())?.trim());
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
let clientApiKey: string | null = null;

export async function getTmdbClient(): Promise<AxiosInstance | null> {
  const apiKey = await getStoredTmdbApiKey();

  if (!apiKey) {
    return null;
  }

  if (!clientInstance || clientApiKey !== apiKey) {
    const instance = axios.create({
      baseURL: getTmdbBaseUrl(),
      timeout: 10000,
      params: {
        api_key: apiKey,
      },
    });
    clientApiKey = apiKey;

    instance.interceptors.response.use(
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
          return instance.request(config);
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

    clientInstance = instance;
  }

  return clientInstance;
}

export async function tmdbGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T | null> {
  const client = await getTmdbClient();
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
