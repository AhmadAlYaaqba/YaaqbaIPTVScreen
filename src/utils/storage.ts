import AsyncStorage from '@react-native-async-storage/async-storage';

import { extractLiveStreamIdentity } from './streamIdentity';

export const WATCH_HISTORY_SCHEMA_VERSION = 2 as const;

export interface WatchProgress {
  contentId: string;
  progress: number;
  timestamp: number;
  totalDuration: number;
  title: string;
  thumbnail?: string;
  seriesId?: string;
  episodeId?: string;
  episodeNumber?: string;
  seasonNumber?: string;
}

interface HistoryBase {
  schemaVersion: typeof WATCH_HISTORY_SCHEMA_VERSION;
  id: string;
  name: string;
  thumbnail?: string;
  progress?: number;
  totalDuration?: number;
  episodeNumber?: number;
  seasonNumber?: number;
  timestamp: number;
}

export interface MovieHistoryEntry extends HistoryBase {
  type: 'movie';
  streamUrl?: string;
  containerExtension?: string;
}

export interface SeriesHistoryEntry extends HistoryBase {
  type: 'series';
  seriesId: string;
  episodeId: string;
  streamUrl?: string;
  containerExtension?: string;
}

export interface LiveHistoryEntry extends HistoryBase {
  type: 'live';
  streamId: string;
  streamUrl: string;
  containerExtension: string;
  categoryId?: string;
  channelName: string;
}

export type WatchHistoryEntry =
  | MovieHistoryEntry
  | SeriesHistoryEntry
  | LiveHistoryEntry;

type WithoutSchemaVersion<T> = T extends WatchHistoryEntry
  ? Omit<T, 'schemaVersion'>
  : never;

export type WatchHistoryInput = WithoutSchemaVersion<WatchHistoryEntry>;
export type RecentlyWatched = WatchHistoryEntry;
export type LatestWatched = WatchHistoryEntry;

const STORAGE_KEYS = {
  MOVIE_PROGRESS: '@movie_progress',
  SERIES_PROGRESS: '@series_progress',
  RECENTLY_WATCHED: '@recently_watched',
  LATEST_WATCHED: '@latest_watched',
} as const;

type StorageBaseKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

let activePlaylistId: string | null = null;

const setActivePlaylistId = (id: string | null) => {
  activePlaylistId = id;
};

const playlistKey = (baseKey: StorageBaseKey, playlistId: string) =>
  `${baseKey}:${playlistId}`;

const scopedKey = (baseKey: StorageBaseKey) =>
  activePlaylistId ? playlistKey(baseKey, activePlaylistId) : baseKey;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function optionalString(value: unknown): string | undefined {
  return asNonEmptyString(value) ?? undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeHistoryEntry(raw: any): WatchHistoryEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const type = raw.type;
  const id = asNonEmptyString(raw.id);
  const name = asNonEmptyString(raw.name);
  if (!id || !name || !['movie', 'series', 'live'].includes(type)) {
    return null;
  }

  const common = {
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
    id,
    name,
    thumbnail: optionalString(raw.thumbnail),
    progress: optionalNumber(raw.progress),
    totalDuration: optionalNumber(raw.totalDuration),
    episodeNumber: optionalNumber(raw.episodeNumber),
    seasonNumber: optionalNumber(raw.seasonNumber),
    timestamp: optionalNumber(raw.timestamp) ?? Date.now(),
  };

  if (type === 'movie') {
    return {
      ...common,
      type,
      streamUrl: optionalString(raw.streamUrl),
      containerExtension: optionalString(raw.containerExtension),
    };
  }

  if (type === 'series') {
    const seriesId = asNonEmptyString(raw.seriesId);
    const episodeId = asNonEmptyString(raw.episodeId);
    if (!seriesId || !episodeId) {
      return null;
    }
    return {
      ...common,
      type,
      seriesId,
      episodeId,
      streamUrl: optionalString(raw.streamUrl),
      containerExtension: optionalString(raw.containerExtension),
    };
  }

  const streamUrl =
    optionalString(raw.streamUrl) ??
    (id.startsWith('http://') || id.startsWith('https://') ? id : undefined);
  const parsedIdentity = streamUrl
    ? extractLiveStreamIdentity(streamUrl)
    : null;
  const streamId = optionalString(raw.streamId) ?? parsedIdentity?.streamId;
  const containerExtension =
    optionalString(raw.containerExtension)?.replace(/^\./, '').toLowerCase() ??
    parsedIdentity?.containerExtension;

  if (!streamUrl || !streamId || !containerExtension) {
    return null;
  }

  return {
    ...common,
    id: streamId,
    type,
    streamId,
    streamUrl,
    containerExtension,
    categoryId: optionalString(raw.categoryId),
    channelName: optionalString(raw.channelName) ?? name,
  };
}

function historyIdentity(item: WatchHistoryEntry): string {
  if (item.type === 'series') {
    return `series:${item.seriesId}`;
  }
  if (item.type === 'live') {
    return `live:${item.streamId}`;
  }
  return `movie:${item.id}`;
}

function normalizeHistoryList(
  raw: unknown,
  limit: number,
): { items: WatchHistoryEntry[]; changed: boolean } {
  if (!Array.isArray(raw)) {
    return { items: [], changed: raw !== undefined && raw !== null };
  }

  const seen = new Set<string>();
  const items: WatchHistoryEntry[] = [];
  let changed = false;

  for (const candidate of raw) {
    const normalized = normalizeHistoryEntry(candidate);
    if (!normalized) {
      changed = true;
      continue;
    }

    const identity = historyIdentity(normalized);
    if (seen.has(identity)) {
      changed = true;
      continue;
    }

    seen.add(identity);
    items.push(normalized);
    if (candidate.schemaVersion !== WATCH_HISTORY_SCHEMA_VERSION) {
      changed = true;
    }
    if (items.length === limit) {
      if (raw.length > limit) {
        changed = true;
      }
      break;
    }
  }

  return { items, changed };
}

function versionHistoryInput(item: WatchHistoryInput): WatchHistoryEntry {
  return {
    ...item,
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
  } as WatchHistoryEntry;
}

function parseProgressMap(value: string | null): Record<string, WatchProgress> {
  const parsed = parseJson<unknown>(value, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, WatchProgress>)
    : {};
}

async function saveHistoryItem(
  baseKey: typeof STORAGE_KEYS.RECENTLY_WATCHED | typeof STORAGE_KEYS.LATEST_WATCHED,
  input: WatchHistoryInput,
  limit: number,
) {
  const key = scopedKey(baseKey);
  const existing = parseJson<unknown>(await AsyncStorage.getItem(key), []);
  const { items } = normalizeHistoryList(existing, limit);
  const item = versionHistoryInput(input);
  const identity = historyIdentity(item);
  const next = [item, ...items.filter(entry => historyIdentity(entry) !== identity)].slice(
    0,
    limit,
  );
  await AsyncStorage.setItem(key, JSON.stringify(next));
}

function mergeLegacyValue(
  baseKey: StorageBaseKey,
  legacyValue: string,
  scopedValue: string | null,
): string {
  if (
    baseKey === STORAGE_KEYS.MOVIE_PROGRESS ||
    baseKey === STORAGE_KEYS.SERIES_PROGRESS
  ) {
    return JSON.stringify({
      ...parseProgressMap(legacyValue),
      ...parseProgressMap(scopedValue),
    });
  }

  const limit = baseKey === STORAGE_KEYS.LATEST_WATCHED ? 10 : 30;
  const legacy = parseJson<unknown>(legacyValue, []);
  const scoped = parseJson<unknown>(scopedValue, []);
  const combined = [
    ...(Array.isArray(scoped) ? scoped : []),
    ...(Array.isArray(legacy) ? legacy : []),
  ];
  return JSON.stringify(normalizeHistoryList(combined, limit).items);
}

export const storage = {
  setActivePlaylistId,

  migrateLegacyPlaylistData: async (playlistId: string): Promise<void> => {
    try {
      const baseKeys = Object.values(STORAGE_KEYS);
      const keys = baseKeys.flatMap(baseKey => [
        baseKey,
        playlistKey(baseKey, playlistId),
      ]);
      const values = new Map(await AsyncStorage.multiGet(keys));
      const writes: [string, string][] = [];
      const removals: string[] = [];

      baseKeys.forEach(baseKey => {
        const legacyValue = values.get(baseKey) ?? null;
        if (!legacyValue) {
          return;
        }
        const targetKey = playlistKey(baseKey, playlistId);
        writes.push([
          targetKey,
          mergeLegacyValue(baseKey, legacyValue, values.get(targetKey) ?? null),
        ]);
        removals.push(baseKey);
      });

      if (writes.length) {
        await AsyncStorage.multiSet(writes);
        await AsyncStorage.multiRemove(removals);
      }
    } catch (error) {
      if (__DEV__) console.error('Error migrating legacy history:', error);
    }
  },

  clearPlaylistData: async (playlistId: string): Promise<void> => {
    if (!playlistId) {
      return;
    }
    await AsyncStorage.multiRemove(
      Object.values(STORAGE_KEYS).map(baseKey =>
        playlistKey(baseKey, playlistId),
      ),
    );
    if (activePlaylistId === playlistId) {
      activePlaylistId = null;
    }
  },

  saveWatchProgress: async (progress: WatchProgress, isMovie: boolean) => {
    try {
      const key = scopedKey(
        isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS,
      );
      const progressMap = parseProgressMap(await AsyncStorage.getItem(key));
      const storageKey = isMovie
        ? progress.contentId
        : `${progress.seriesId}_${progress.episodeId}`;
      progressMap[storageKey] = progress;
      await AsyncStorage.setItem(key, JSON.stringify(progressMap));
    } catch (error) {
      if (__DEV__) console.error('Error saving watch progress:', error);
    }
  },

  getWatchProgress: async (
    contentId: string,
    isMovie: boolean,
    seriesId?: string,
    episodeId?: string,
  ): Promise<WatchProgress | null> => {
    try {
      const key = scopedKey(
        isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS,
      );
      const progressMap = parseProgressMap(await AsyncStorage.getItem(key));
      const storageKey = isMovie ? contentId : `${seriesId}_${episodeId}`;
      return progressMap[storageKey] || null;
    } catch (error) {
      if (__DEV__) console.error('Error getting watch progress:', error);
      return null;
    }
  },

  saveRecentlyWatched: async (item: WatchHistoryInput) => {
    try {
      await saveHistoryItem(STORAGE_KEYS.RECENTLY_WATCHED, item, 30);
    } catch (error) {
      if (__DEV__) console.error('Error saving recently watched:', error);
    }
  },

  getRecentlyWatched: async (): Promise<RecentlyWatched[]> => {
    try {
      const key = scopedKey(STORAGE_KEYS.RECENTLY_WATCHED);
      const raw = parseJson<unknown>(await AsyncStorage.getItem(key), []);
      const normalized = normalizeHistoryList(raw, 30);
      if (normalized.changed) {
        await AsyncStorage.setItem(key, JSON.stringify(normalized.items));
      }
      return normalized.items;
    } catch (error) {
      if (__DEV__) console.error('Error getting recently watched:', error);
      return [];
    }
  },

  clearWatchProgress: async (
    contentId: string,
    isMovie: boolean,
    seriesId?: string,
    episodeId?: string,
  ) => {
    try {
      const key = scopedKey(
        isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS,
      );
      const progressMap = parseProgressMap(await AsyncStorage.getItem(key));
      const storageKey = isMovie ? contentId : `${seriesId}_${episodeId}`;
      delete progressMap[storageKey];
      await AsyncStorage.setItem(key, JSON.stringify(progressMap));
    } catch (error) {
      if (__DEV__) console.error('Error clearing watch progress:', error);
    }
  },

  getAllProgress: async (
    isMovie: boolean,
  ): Promise<Record<string, WatchProgress>> => {
    try {
      const key = scopedKey(
        isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS,
      );
      return parseProgressMap(await AsyncStorage.getItem(key));
    } catch (error) {
      if (__DEV__) console.error('Error getting all progress:', error);
      return {};
    }
  },

  saveLatestWatched: async (item: WatchHistoryInput) => {
    try {
      await saveHistoryItem(STORAGE_KEYS.LATEST_WATCHED, item, 10);
    } catch (error) {
      if (__DEV__) console.error('Error saving latest watched:', error);
    }
  },

  getLatestWatched: async (): Promise<LatestWatched[]> => {
    try {
      const latestKey = scopedKey(STORAGE_KEYS.LATEST_WATCHED);
      const movieKey = scopedKey(STORAGE_KEYS.MOVIE_PROGRESS);
      const seriesKey = scopedKey(STORAGE_KEYS.SERIES_PROGRESS);
      const values = new Map(
        await AsyncStorage.multiGet([latestKey, movieKey, seriesKey]),
      );
      const raw = parseJson<unknown>(values.get(latestKey) ?? null, []);
      const normalized = normalizeHistoryList(raw, 10);
      const movieProgress = parseProgressMap(values.get(movieKey) ?? null);
      const seriesProgress = parseProgressMap(values.get(seriesKey) ?? null);

      const items = normalized.items.map(item => {
        const progress =
          item.type === 'movie'
            ? movieProgress[item.id]
            : item.type === 'series'
              ? seriesProgress[`${item.seriesId}_${item.episodeId}`]
              : undefined;
        return progress
          ? {
              ...item,
              progress: progress.progress,
              totalDuration: progress.totalDuration,
            }
          : item;
      });

      if (normalized.changed) {
        await AsyncStorage.setItem(latestKey, JSON.stringify(items));
      }
      return items;
    } catch (error) {
      if (__DEV__) console.error('Error getting latest watched:', error);
      return [];
    }
  },
};
