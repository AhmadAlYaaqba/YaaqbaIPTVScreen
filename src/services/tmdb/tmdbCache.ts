import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@tmdb_cache:';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENCY = 4;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function createLimiter(maxConcurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= maxConcurrency || queue.length === 0) {
      return;
    }
    active += 1;
    const run = queue.shift();
    run?.();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = () => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active -= 1;
            next();
          });
      };

      queue.push(execute);
      next();
    });
  };
}

class TmdbCache {
  private memory = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  readonly limit = createLimiter(MAX_CONCURRENCY);

  getSync<T>(key: string): T | undefined {
    const entry = this.memory.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const memoryHit = this.getSync<T>(key);
    if (memoryHit !== undefined) {
      return memoryHit;
    }

    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!raw) {
        return undefined;
      }
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > entry.expiresAt) {
        await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        return undefined;
      }
      this.memory.set(key, entry as CacheEntry<unknown>);
      return entry.value;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    this.memory.set(key, entry as CacheEntry<unknown>);
    try {
      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}${key}`,
        JSON.stringify(entry),
      );
    } catch {
      // Non-fatal: memory cache still works for this session.
    }
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { allowNull?: boolean; ttlMs?: number },
  ): Promise<T | null> {
    const syncHit = this.getSync<T | null>(key);
    if (syncHit !== undefined) {
      return syncHit;
    }

    const asyncHit = await this.get<T | null>(key);
    if (asyncHit !== undefined) {
      return asyncHit;
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T | null>;
    }

    const promise = this.limit(async () => {
      try {
        const value = await fetcher();
        if (value !== null || options?.allowNull) {
          await this.set(key, value, options?.ttlMs);
        }
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    });

    this.inFlight.set(key, promise);
    return promise;
  }
}

export const tmdbCache = new TmdbCache();

export function buildSearchCacheKey(
  type: 'movie' | 'series',
  query: string,
  year?: number,
): string {
  const normalizedQuery = query.trim().toLowerCase();
  return `search:${type}:${normalizedQuery}:${year ?? 'any'}`;
}

export function buildDetailsCacheKey(
  type: 'movie' | 'series',
  id: string,
): string {
  return `details:${type}:${id}`;
}

export function buildSeasonCacheKey(tvId: string, season: number): string {
  return `season:${tvId}:${season}`;
}
