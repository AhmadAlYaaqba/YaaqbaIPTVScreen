import AsyncStorage from '@react-native-async-storage/async-storage';

import { extractLiveStreamIdentity } from './streamIdentity';

export const WATCH_HISTORY_SCHEMA_VERSION = 3 as const;
const HISTORY_LIMIT = 200;
const CONTINUE_WATCHING_LIMIT = 10;
const RECENT_CHANNEL_LIMIT = 30;

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
  containerExtension: string;
  timestamp: number;
  completed: boolean;
}

export interface MovieHistoryEntry extends HistoryBase {
  type: 'movie';
  streamId: string;
}

export interface SeriesHistoryEntry extends HistoryBase {
  type: 'series';
  seriesId: string;
  episodeId: string;
  seriesName?: string;
  episodeName?: string;
}

export interface LiveHistoryEntry extends HistoryBase {
  type: 'live';
  streamId: string;
  categoryId?: string;
  channelName: string;
}

export type WatchHistoryEntry =
  | MovieHistoryEntry
  | SeriesHistoryEntry
  | LiveHistoryEntry;

type WritableHistoryEntry<T extends WatchHistoryEntry> =
  T extends WatchHistoryEntry
    ? Omit<
        T,
        'schemaVersion' | 'completed' | 'containerExtension' | 'streamId'
      > & {
        completed?: boolean;
        containerExtension?: string;
        streamId?: string;
      }
    : never;

export type WatchHistoryInput = WritableHistoryEntry<WatchHistoryEntry>;
export type RecentlyWatched = WatchHistoryEntry;
export type LatestWatched = WatchHistoryEntry;

export interface FavoriteChannel {
  streamId: string;
  name: string;
  extension: string;
  icon?: string;
  categoryId?: string;
  favoritedAt: number;
}

export interface RecentChannel extends Omit<FavoriteChannel, 'favoritedAt'> {
  lastViewedAt: number;
}

const STORAGE_KEYS = {
  MOVIE_PROGRESS: '@movie_progress',
  SERIES_PROGRESS: '@series_progress',
  RECENTLY_WATCHED: '@recently_watched',
  LATEST_WATCHED: '@latest_watched',
  WATCH_HISTORY: '@watch_history',
  FAVORITE_CHANNELS: '@favorite_channels',
} as const;

type StorageBaseKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

let activePlaylistId: string | null = null;

const setActivePlaylistId = (id: string | null) => {
  activePlaylistId = id;
};

const playlistKey = (baseKey: StorageBaseKey, playlistId: string) =>
  `${baseKey}:${playlistId}`;

const scopedKey = (baseKey: StorageBaseKey, playlistId?: string | null) => {
  const scope = playlistId ?? activePlaylistId;
  return scope ? playlistKey(baseKey, scope) : baseKey;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
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

function normalizeExtension(value: unknown, fallback: string): string {
  const extension = optionalString(value)?.replace(/^\./, '').toLowerCase();
  return extension && /^[a-z0-9]{1,10}$/.test(extension) ? extension : fallback;
}

function extractVodStreamId(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const pathname = new URL(value).pathname;
    const match = pathname.match(
      /\/(?:movie|series)\/[^/]+\/[^/]+\/([^/.?]+)(?:\.[a-z0-9]+)?$/i,
    );
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function normalizeHistoryEntry(raw: any): WatchHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;

  const type = raw.type === 'episode' ? 'series' : raw.type;
  if (!['movie', 'series', 'live'].includes(type)) return null;

  const legacyUrl = optionalString(raw.streamUrl);
  const rawId = optionalString(raw.id);
  const timestamp = optionalNumber(raw.timestamp) ?? Date.now();
  const completed = raw.completed === true;
  const progress = optionalNumber(raw.progress);
  const totalDuration = optionalNumber(raw.totalDuration);
  const thumbnail = optionalString(raw.thumbnail);
  const episodeNumber = optionalNumber(raw.episodeNumber);
  const seasonNumber = optionalNumber(raw.seasonNumber);

  if (type === 'live') {
    const legacyIdentity = extractLiveStreamIdentity(legacyUrl ?? rawId ?? '');
    const streamId = optionalString(raw.streamId) ?? legacyIdentity?.streamId;
    const channelName =
      optionalString(raw.channelName) ?? optionalString(raw.name);
    if (!streamId || !channelName) return null;
    return {
      schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
      id: streamId,
      type,
      streamId,
      name: channelName,
      channelName,
      categoryId: optionalString(raw.categoryId),
      containerExtension: normalizeExtension(
        raw.containerExtension ?? legacyIdentity?.containerExtension,
        'm3u8',
      ),
      thumbnail,
      timestamp,
      completed: false,
    };
  }

  if (type === 'movie') {
    const streamId =
      optionalString(raw.streamId) ??
      (rawId && !/^https?:/i.test(rawId) ? rawId : null) ??
      extractVodStreamId(legacyUrl ?? rawId);
    const name = optionalString(raw.name);
    if (!streamId || !name) return null;
    return {
      schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
      id: streamId,
      type,
      streamId,
      name,
      containerExtension: normalizeExtension(raw.containerExtension, 'mp4'),
      thumbnail,
      progress,
      totalDuration,
      timestamp,
      completed,
    };
  }

  const seriesId = optionalString(raw.seriesId) ?? rawId;
  const episodeId =
    optionalString(raw.episodeId) ??
    optionalString(raw.streamId) ??
    extractVodStreamId(legacyUrl);
  const episodeName =
    optionalString(raw.episodeName) ?? optionalString(raw.name);
  if (!seriesId || !episodeId || !episodeName) return null;
  return {
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
    id: seriesId,
    type: 'series',
    seriesId,
    episodeId,
    name: episodeName,
    episodeName,
    seriesName: optionalString(raw.seriesName),
    containerExtension: normalizeExtension(raw.containerExtension, 'mp4'),
    thumbnail,
    progress,
    totalDuration,
    episodeNumber,
    seasonNumber,
    timestamp,
    completed,
  };
}

export function watchHistoryIdentity(item: {
  type: WatchHistoryEntry['type'];
  id?: string;
  streamId?: string;
  seriesId?: string;
  episodeId?: string;
}): string {
  if (item.type === 'series') {
    return `series:${item.seriesId ?? item.id}:${item.episodeId}`;
  }
  const streamId = item.streamId ?? item.id;
  return `${item.type}:${streamId}`;
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
  const candidates = [...raw].sort(
    (a, b) =>
      (optionalNumber((b as any)?.timestamp) ?? 0) -
      (optionalNumber((a as any)?.timestamp) ?? 0),
  );
  for (const candidate of candidates) {
    const normalized = normalizeHistoryEntry(candidate);
    if (!normalized) {
      changed = true;
      continue;
    }
    const identity = watchHistoryIdentity(normalized);
    if (seen.has(identity)) {
      changed = true;
      continue;
    }
    seen.add(identity);
    items.push(normalized);
    if (
      candidate.schemaVersion !== WATCH_HISTORY_SCHEMA_VERSION ||
      candidate.streamUrl
    ) {
      changed = true;
    }
    if (items.length === limit) {
      if (raw.length > limit) changed = true;
      break;
    }
  }
  return { items, changed };
}

function versionHistoryInput(item: WatchHistoryInput): WatchHistoryEntry {
  return normalizeHistoryEntry({
    ...item,
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
  }) as WatchHistoryEntry;
}

function parseProgressMap(value: string | null): Record<string, WatchProgress> {
  const parsed = parseJson<unknown>(value, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, WatchProgress>)
    : {};
}

async function saveHistoryItem(
  baseKey:
    | typeof STORAGE_KEYS.WATCH_HISTORY
    | typeof STORAGE_KEYS.LATEST_WATCHED,
  input: WatchHistoryInput,
  limit: number,
  playlistId?: string | null,
) {
  const key = scopedKey(baseKey, playlistId);
  const existing = parseJson<unknown>(await AsyncStorage.getItem(key), []);
  const { items } = normalizeHistoryList(existing, limit);
  const item = versionHistoryInput(input);
  const identity = watchHistoryIdentity(item);
  const next = [
    item,
    ...items.filter(entry => watchHistoryIdentity(entry) !== identity),
  ].slice(0, limit);
  await AsyncStorage.setItem(key, JSON.stringify(next));
}

function historyLimitForKey(baseKey: StorageBaseKey): number {
  return baseKey === STORAGE_KEYS.WATCH_HISTORY
    ? HISTORY_LIMIT
    : baseKey === STORAGE_KEYS.LATEST_WATCHED
    ? CONTINUE_WATCHING_LIMIT
    : 30;
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
  if (baseKey === STORAGE_KEYS.FAVORITE_CHANNELS) {
    const scoped = parseJson<FavoriteChannel[]>(scopedValue, []);
    const legacy = parseJson<FavoriteChannel[]>(legacyValue, []);
    return JSON.stringify([...scoped, ...legacy]);
  }

  const legacy = parseJson<unknown>(legacyValue, []);
  const scoped = parseJson<unknown>(scopedValue, []);
  return JSON.stringify(
    normalizeHistoryList(
      [
        ...(Array.isArray(scoped) ? scoped : []),
        ...(Array.isArray(legacy) ? legacy : []),
      ],
      historyLimitForKey(baseKey),
    ).items,
  );
}

function normalizeFavorite(raw: any): FavoriteChannel | null {
  if (!raw || typeof raw !== 'object') return null;
  const streamId = asNonEmptyString(raw.streamId ?? raw.stream_id);
  const name = asNonEmptyString(raw.name ?? raw.channelName);
  if (!streamId || !name) return null;
  return {
    streamId,
    name,
    extension: normalizeExtension(
      raw.extension ?? raw.containerExtension ?? raw.container_extension,
      'm3u8',
    ),
    icon: optionalString(raw.icon ?? raw.thumbnail ?? raw.stream_icon),
    categoryId: optionalString(raw.categoryId ?? raw.category_id),
    favoritedAt: optionalNumber(raw.favoritedAt) ?? Date.now(),
  };
}

function normalizeFavorites(raw: unknown): FavoriteChannel[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .map(normalizeFavorite)
    .filter((item): item is FavoriteChannel => {
      if (!item || seen.has(item.streamId)) return false;
      seen.add(item.streamId);
      return true;
    })
    .sort((a, b) => b.favoritedAt - a.favoritedAt);
}

async function readHistory(playlistId?: string | null) {
  const historyKey = scopedKey(STORAGE_KEYS.WATCH_HISTORY, playlistId);
  const recentKey = scopedKey(STORAGE_KEYS.RECENTLY_WATCHED, playlistId);
  const latestKey = scopedKey(STORAGE_KEYS.LATEST_WATCHED, playlistId);
  const values = new Map(
    await AsyncStorage.multiGet([historyKey, recentKey, latestKey]),
  );
  const combined = [
    ...parseJson<unknown[]>(values.get(historyKey) ?? null, []),
    ...parseJson<unknown[]>(values.get(recentKey) ?? null, []),
    ...parseJson<unknown[]>(values.get(latestKey) ?? null, []),
  ];
  const normalized = normalizeHistoryList(combined, HISTORY_LIMIT);
  // Reads used to rewrite the list unconditionally on every screen focus;
  // only persist when the merge/normalization changed what is stored.
  const nextJson = JSON.stringify(normalized.items);
  if (nextJson !== values.get(historyKey)) {
    await AsyncStorage.setItem(historyKey, nextJson);
  }
  if (values.get(recentKey)) await AsyncStorage.removeItem(recentKey);
  return normalized.items;
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
        if (!legacyValue) return;
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
      await readHistory(playlistId);
    } catch (error) {
      if (__DEV__) console.error('Error migrating legacy history:', error);
    }
  },

  clearPlaylistData: async (playlistId: string): Promise<void> => {
    if (!playlistId) return;
    await AsyncStorage.multiRemove(
      Object.values(STORAGE_KEYS).map(baseKey =>
        playlistKey(baseKey, playlistId),
      ),
    );
    if (activePlaylistId === playlistId) activePlaylistId = null;
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
      return (
        progressMap[isMovie ? contentId : `${seriesId}_${episodeId}`] ?? null
      );
    } catch (error) {
      if (__DEV__) console.error('Error getting watch progress:', error);
      return null;
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
      delete progressMap[isMovie ? contentId : `${seriesId}_${episodeId}`];
      await AsyncStorage.setItem(key, JSON.stringify(progressMap));
    } catch (error) {
      if (__DEV__) console.error('Error clearing watch progress:', error);
    }
  },

  getAllProgress: async (
    isMovie: boolean,
  ): Promise<Record<string, WatchProgress>> => {
    try {
      return parseProgressMap(
        await AsyncStorage.getItem(
          scopedKey(
            isMovie
              ? STORAGE_KEYS.MOVIE_PROGRESS
              : STORAGE_KEYS.SERIES_PROGRESS,
          ),
        ),
      );
    } catch (error) {
      if (__DEV__) console.error('Error getting all progress:', error);
      return {};
    }
  },

  saveWatchHistory: async (
    item: WatchHistoryInput,
    playlistId?: string | null,
  ) => {
    try {
      await saveHistoryItem(
        STORAGE_KEYS.WATCH_HISTORY,
        item,
        HISTORY_LIMIT,
        playlistId,
      );
    } catch (error) {
      if (__DEV__) console.error('Error saving watch history:', error);
    }
  },

  getWatchHistory: async (
    playlistId?: string | null,
  ): Promise<WatchHistoryEntry[]> => {
    try {
      return await readHistory(playlistId);
    } catch (error) {
      if (__DEV__) console.error('Error loading watch history:', error);
      return [];
    }
  },

  saveRecentlyWatched: async (item: WatchHistoryInput) => {
    await storage.saveWatchHistory(item);
  },

  getRecentlyWatched: async (): Promise<RecentlyWatched[]> =>
    storage.getWatchHistory(),

  saveLatestWatched: async (item: WatchHistoryInput) => {
    if (item.type === 'live' || item.completed) return;
    try {
      await saveHistoryItem(
        STORAGE_KEYS.LATEST_WATCHED,
        item,
        CONTINUE_WATCHING_LIMIT,
      );
    } catch (error) {
      if (__DEV__) console.error('Error saving Continue Watching:', error);
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
      const normalized = normalizeHistoryList(
        parseJson<unknown>(values.get(latestKey) ?? null, []),
        CONTINUE_WATCHING_LIMIT,
      );
      const movieProgress = parseProgressMap(values.get(movieKey) ?? null);
      const seriesProgress = parseProgressMap(values.get(seriesKey) ?? null);
      const items = normalized.items
        .filter(
          (item): item is MovieHistoryEntry | SeriesHistoryEntry =>
            item.type !== 'live' && !item.completed,
        )
        .map(item => {
          const progress =
            item.type === 'movie'
              ? movieProgress[item.streamId]
              : seriesProgress[`${item.seriesId}_${item.episodeId}`];
          return progress
            ? {
                ...item,
                progress: progress.progress,
                totalDuration: progress.totalDuration,
              }
            : item;
        });
      if (normalized.changed || items.length !== normalized.items.length) {
        await AsyncStorage.setItem(latestKey, JSON.stringify(items));
      }
      return items;
    } catch (error) {
      if (__DEV__) console.error('Error loading Continue Watching:', error);
      return [];
    }
  },

  completeWatchProgress: async (
    contentId: string,
    isMovie: boolean,
    seriesId?: string,
    episodeId?: string,
  ): Promise<void> => {
    try {
      const progressKey = scopedKey(
        isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS,
      );
      const latestKey = scopedKey(STORAGE_KEYS.LATEST_WATCHED);
      const historyKey = scopedKey(STORAGE_KEYS.WATCH_HISTORY);
      const recentKey = scopedKey(STORAGE_KEYS.RECENTLY_WATCHED);
      const values = new Map(
        await AsyncStorage.multiGet([
          progressKey,
          latestKey,
          historyKey,
          recentKey,
        ]),
      );
      const progressMap = parseProgressMap(values.get(progressKey) ?? null);
      const progressStorageKey = isMovie
        ? contentId
        : `${seriesId}_${episodeId}`;
      const completedProgress = progressMap[progressStorageKey];
      delete progressMap[progressStorageKey];

      const matches = (item: WatchHistoryEntry) =>
        isMovie
          ? item.type === 'movie' && item.streamId === contentId
          : item.type === 'series' &&
            item.seriesId === seriesId &&
            item.episodeId === episodeId;
      const latest = normalizeHistoryList(
        parseJson<unknown>(values.get(latestKey) ?? null, []),
        CONTINUE_WATCHING_LIMIT,
      ).items.filter(item => !matches(item));
      const history = normalizeHistoryList(
        [
          ...parseJson<unknown[]>(values.get(historyKey) ?? null, []),
          ...parseJson<unknown[]>(values.get(recentKey) ?? null, []),
        ],
        HISTORY_LIMIT,
      ).items.map(item =>
        matches(item)
          ? {
              ...item,
              completed: true,
              progress:
                completedProgress?.totalDuration ??
                item.totalDuration ??
                item.progress,
              totalDuration:
                completedProgress?.totalDuration ?? item.totalDuration,
              timestamp: Date.now(),
            }
          : item,
      );

      await AsyncStorage.multiSet([
        [progressKey, JSON.stringify(progressMap)],
        [latestKey, JSON.stringify(latest)],
        [historyKey, JSON.stringify(history)],
        [recentKey, '[]'],
      ]);
    } catch (error) {
      if (__DEV__) console.error('Error completing watch progress:', error);
    }
  },

  removeHistoryEntry: async (item: WatchHistoryEntry): Promise<void> => {
    const historyKey = scopedKey(STORAGE_KEYS.WATCH_HISTORY);
    const latestKey = scopedKey(STORAGE_KEYS.LATEST_WATCHED);
    const movieKey = scopedKey(STORAGE_KEYS.MOVIE_PROGRESS);
    const seriesKey = scopedKey(STORAGE_KEYS.SERIES_PROGRESS);
    const values = new Map(
      await AsyncStorage.multiGet([historyKey, latestKey, movieKey, seriesKey]),
    );
    const identity = watchHistoryIdentity(item);
    const withoutItem = (raw: unknown, limit: number) =>
      normalizeHistoryList(raw, limit).items.filter(
        candidate => watchHistoryIdentity(candidate) !== identity,
      );
    const movieProgress = parseProgressMap(values.get(movieKey) ?? null);
    const seriesProgress = parseProgressMap(values.get(seriesKey) ?? null);
    if (item.type === 'movie') delete movieProgress[item.streamId];
    if (item.type === 'series') {
      delete seriesProgress[`${item.seriesId}_${item.episodeId}`];
    }
    await AsyncStorage.multiSet([
      [
        historyKey,
        JSON.stringify(
          withoutItem(
            parseJson(values.get(historyKey) ?? null, []),
            HISTORY_LIMIT,
          ),
        ),
      ],
      [
        latestKey,
        JSON.stringify(
          withoutItem(
            parseJson(values.get(latestKey) ?? null, []),
            CONTINUE_WATCHING_LIMIT,
          ),
        ),
      ],
      [movieKey, JSON.stringify(movieProgress)],
      [seriesKey, JSON.stringify(seriesProgress)],
    ]);
  },

  clearWatchHistory: async (): Promise<void> => {
    await AsyncStorage.multiSet([
      [scopedKey(STORAGE_KEYS.WATCH_HISTORY), '[]'],
      [scopedKey(STORAGE_KEYS.RECENTLY_WATCHED), '[]'],
      [scopedKey(STORAGE_KEYS.LATEST_WATCHED), '[]'],
      [scopedKey(STORAGE_KEYS.MOVIE_PROGRESS), '{}'],
      [scopedKey(STORAGE_KEYS.SERIES_PROGRESS), '{}'],
    ]);
  },

  getFavoriteChannels: async (
    playlistId?: string | null,
  ): Promise<FavoriteChannel[]> => {
    const key = scopedKey(STORAGE_KEYS.FAVORITE_CHANNELS, playlistId);
    const raw = await AsyncStorage.getItem(key);
    const favorites = normalizeFavorites(parseJson<unknown>(raw, []));
    const nextJson = JSON.stringify(favorites);
    if (nextJson !== raw) {
      await AsyncStorage.setItem(key, nextJson);
    }
    return favorites;
  },

  toggleFavoriteChannel: async (
    channel: Omit<FavoriteChannel, 'favoritedAt'>,
    playlistId?: string | null,
  ): Promise<FavoriteChannel[]> => {
    const key = scopedKey(STORAGE_KEYS.FAVORITE_CHANNELS, playlistId);
    const favorites = normalizeFavorites(
      parseJson<unknown>(await AsyncStorage.getItem(key), []),
    );
    const exists = favorites.some(item => item.streamId === channel.streamId);
    const next = exists
      ? favorites.filter(item => item.streamId !== channel.streamId)
      : [{ ...channel, favoritedAt: Date.now() }, ...favorites];
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  },

  reconcileFavoriteChannels: async (
    channels: Array<{
      stream_id: string | number;
      name: string;
      stream_icon?: string;
      icon?: string;
      container_extension?: string;
      category_id?: string | number;
    }>,
    playlistId?: string | null,
  ): Promise<FavoriteChannel[]> => {
    const key = scopedKey(STORAGE_KEYS.FAVORITE_CHANNELS, playlistId);
    const favorites = await storage.getFavoriteChannels(playlistId);
    if (favorites.length === 0) return favorites;
    // One pass over the category instead of a scan per favorite.
    const byStreamId = new Map(
      channels.map(channel => [String(channel.stream_id), channel] as const),
    );
    let changed = false;
    const next = favorites.map(favorite => {
      const fresh = byStreamId.get(favorite.streamId);
      if (!fresh) return favorite;
      const updated = {
        ...favorite,
        name: fresh.name || favorite.name,
        icon: fresh.stream_icon || fresh.icon || favorite.icon,
        extension: normalizeExtension(
          fresh.container_extension,
          favorite.extension,
        ),
        categoryId: optionalString(fresh.category_id) ?? favorite.categoryId,
      };
      if (
        updated.name !== favorite.name ||
        updated.icon !== favorite.icon ||
        updated.extension !== favorite.extension ||
        updated.categoryId !== favorite.categoryId
      ) {
        changed = true;
        return updated;
      }
      return favorite;
    });
    if (changed) await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  },

  getRecentChannels: async (
    playlistId?: string | null,
  ): Promise<RecentChannel[]> => {
    const history = await storage.getWatchHistory(playlistId);
    return history
      .filter((item): item is LiveHistoryEntry => item.type === 'live')
      .slice(0, RECENT_CHANNEL_LIMIT)
      .map(item => ({
        streamId: item.streamId,
        name: item.channelName,
        extension: item.containerExtension,
        icon: item.thumbnail,
        categoryId: item.categoryId,
        lastViewedAt: item.timestamp,
      }));
  },
};
