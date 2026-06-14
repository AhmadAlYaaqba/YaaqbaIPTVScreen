import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@tmdb_cache:';
const DETAIL_INDEX_KEY = `${STORAGE_PREFIX}detail:index`;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENCY = 4;
const MAX_SESSION_ENTRIES = 50;
const MAX_PERSISTED_DETAILS = 5;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  touchedAt: number;
}

interface DetailIndexItem {
  key: string;
  touchedAt: number;
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

  private storageKey(key: string): string {
    return `${STORAGE_PREFIX}${key}`;
  }

  private canPersist(key: string): boolean {
    return key.startsWith('details:movie:') || key.startsWith('details:series:');
  }

  private remember(key: string, entry: CacheEntry<unknown>) {
    this.memory.delete(key);
    this.memory.set(key, entry);
    this.pruneMemory();
  }

  private pruneMemory() {
    while (this.memory.size > MAX_SESSION_ENTRIES) {
      const oldestKey = this.memory.keys().next().value;
      if (!oldestKey) {
        return;
      }
      this.memory.delete(oldestKey);
    }
  }

  private async readDetailIndex(): Promise<DetailIndexItem[]> {
    try {
      const raw = await AsyncStorage.getItem(DETAIL_INDEX_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as DetailIndexItem[];
      return Array.isArray(parsed)
        ? parsed.filter(item => item?.key && item?.touchedAt)
        : [];
    } catch {
      return [];
    }
  }

  private async persistDetailEntry<T>(
    key: string,
    entry: CacheEntry<T>,
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey(key), JSON.stringify(entry));

      const index = await this.readDetailIndex();
      const nextIndex = [
        { key, touchedAt: entry.touchedAt },
        ...index.filter(item => item.key !== key),
      ]
        .sort((a, b) => b.touchedAt - a.touchedAt)
        .slice(0, MAX_PERSISTED_DETAILS);

      const evicted = index.filter(
        item => !nextIndex.some(kept => kept.key === item.key),
      );

      await Promise.all([
        AsyncStorage.setItem(DETAIL_INDEX_KEY, JSON.stringify(nextIndex)),
        ...evicted.map(item => AsyncStorage.removeItem(this.storageKey(item.key))),
      ]);
    } catch {
      // Non-fatal: memory cache still works for this session.
    }
  }

  private async removePersistedDetail(key: string): Promise<void> {
    try {
      const index = await this.readDetailIndex();
      await Promise.all([
        AsyncStorage.removeItem(this.storageKey(key)),
        AsyncStorage.setItem(
          DETAIL_INDEX_KEY,
          JSON.stringify(index.filter(item => item.key !== key)),
        ),
      ]);
    } catch {
      // Ignore storage cleanup failures.
    }
  }

  getSync<T>(key: string): T | undefined {
    const entry = this.memory.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return undefined;
    }
    this.remember(key, { ...entry, touchedAt: Date.now() });
    return entry.value as T;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const memoryHit = this.getSync<T>(key);
    if (memoryHit !== undefined) {
      return memoryHit;
    }
    if (!this.canPersist(key)) {
      return undefined;
    }

    try {
      const raw = await AsyncStorage.getItem(this.storageKey(key));
      if (!raw) {
        return undefined;
      }
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > entry.expiresAt) {
        await this.removePersistedDetail(key);
        return undefined;
      }
      const touchedEntry = { ...entry, touchedAt: Date.now() };
      this.remember(key, touchedEntry as CacheEntry<unknown>);
      await this.persistDetailEntry(key, touchedEntry);
      return entry.value;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
      touchedAt: Date.now(),
    };
    this.remember(key, entry as CacheEntry<unknown>);
    if (this.canPersist(key)) {
      await this.persistDetailEntry(key, entry);
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
