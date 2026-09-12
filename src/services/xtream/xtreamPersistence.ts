import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryKey } from '@tanstack/react-query';

import { xtreamQueryKeys } from './xtreamQueries';

export const XTREAM_PERSISTENCE_KEY = '@xtream_query_cache_v1';
export const XTREAM_PERSISTENCE_VERSION = 1 as const;
export const XTREAM_PERSISTENCE_MAX_BYTES = 3 * 1024 * 1024;
export const XTREAM_PERSISTENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PersistedXtreamQuery {
  queryKey: QueryKey;
  data: unknown;
  dataUpdatedAt: number;
}

interface PersistedXtreamSnapshot {
  version: typeof XTREAM_PERSISTENCE_VERSION;
  entries: PersistedXtreamQuery[];
}

function isXtreamKey(queryKey: QueryKey): boolean {
  return queryKey[0] === xtreamQueryKeys.all[0];
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export function createXtreamSnapshot(
  entries: PersistedXtreamQuery[],
  now = Date.now(),
  maxBytes = XTREAM_PERSISTENCE_MAX_BYTES,
): string | null {
  const serializedEntries = entries
    .filter(
      entry =>
        entry.dataUpdatedAt > 0 &&
        now - entry.dataUpdatedAt <= XTREAM_PERSISTENCE_MAX_AGE_MS,
    )
    .sort((a, b) => a.dataUpdatedAt - b.dataUpdatedAt)
    .flatMap(entry => {
      try {
        return [{ entry, json: JSON.stringify(entry) }];
      } catch {
        return [];
      }
    });

  const prefix = `{"version":${XTREAM_PERSISTENCE_VERSION},"entries":[`;
  const suffix = ']}';
  let totalBytes = utf8ByteLength(prefix) + utf8ByteLength(suffix);
  serializedEntries.forEach((item, index) => {
    totalBytes += utf8ByteLength(item.json) + (index > 0 ? 1 : 0);
  });

  while (serializedEntries.length > 0 && totalBytes > maxBytes) {
    const removed = serializedEntries.shift();
    if (removed) {
      totalBytes -= utf8ByteLength(removed.json);
      if (serializedEntries.length > 0) {
        totalBytes -= 1;
      }
    }
  }

  if (serializedEntries.length === 0) {
    return null;
  }

  return `${prefix}${serializedEntries.map(item => item.json).join(',')}${suffix}`;
}

function getSuccessfulXtreamQueries(
  queryClient: QueryClient,
): PersistedXtreamQuery[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter(
      query => isXtreamKey(query.queryKey) && query.state.status === 'success',
    )
    .map(query => ({
      queryKey: query.queryKey,
      data: query.state.data,
      dataUpdatedAt: query.state.dataUpdatedAt,
    }));
}

export async function persistXtreamQueryCache(
  queryClient: QueryClient,
): Promise<void> {
  const snapshot = createXtreamSnapshot(getSuccessfulXtreamQueries(queryClient));
  if (snapshot) {
    await AsyncStorage.setItem(XTREAM_PERSISTENCE_KEY, snapshot);
  } else {
    await AsyncStorage.removeItem(XTREAM_PERSISTENCE_KEY);
  }
}

export async function hydrateXtreamQueryCache(
  queryClient: QueryClient,
  now = Date.now(),
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(XTREAM_PERSISTENCE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedXtreamSnapshot>;
    if (
      parsed.version !== XTREAM_PERSISTENCE_VERSION ||
      !Array.isArray(parsed.entries)
    ) {
      await AsyncStorage.removeItem(XTREAM_PERSISTENCE_KEY);
      return;
    }

    const validEntries = parsed.entries.filter(
      entry =>
        Array.isArray(entry?.queryKey) &&
        isXtreamKey(entry.queryKey) &&
        typeof entry.dataUpdatedAt === 'number' &&
        now - entry.dataUpdatedAt <= XTREAM_PERSISTENCE_MAX_AGE_MS,
    );

    validEntries.forEach(entry => {
      const existingUpdatedAt =
        queryClient.getQueryState(entry.queryKey)?.dataUpdatedAt ?? 0;
      if (entry.dataUpdatedAt > existingUpdatedAt) {
        queryClient.setQueryData(entry.queryKey, entry.data, {
          updatedAt: entry.dataUpdatedAt,
        });
      }
    });

    const cleanedSnapshot = createXtreamSnapshot(validEntries, now);
    if (cleanedSnapshot) {
      await AsyncStorage.setItem(XTREAM_PERSISTENCE_KEY, cleanedSnapshot);
    } else {
      await AsyncStorage.removeItem(XTREAM_PERSISTENCE_KEY);
    }
  } catch (error) {
    await AsyncStorage.removeItem(XTREAM_PERSISTENCE_KEY);
    if (__DEV__) console.error('Could not hydrate Xtream cache:', error);
  }
}

export function subscribeToXtreamQueryPersistence(
  queryClient: QueryClient,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writeChain = Promise.resolve();

  const unsubscribe = queryClient.getQueryCache().subscribe(event => {
    if (!event?.query || !isXtreamKey(event.query.queryKey)) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      writeChain = writeChain
        .then(() => persistXtreamQueryCache(queryClient))
        .catch(error => {
          if (__DEV__) console.error('Could not persist Xtream cache:', error);
        });
    }, 500);
  });

  return () => {
    unsubscribe();
    if (timer) {
      clearTimeout(timer);
    }
  };
}

export async function removeXtreamPlaylistCache(
  queryClient: QueryClient,
  playlistId: string,
): Promise<void> {
  queryClient.removeQueries({
    queryKey: xtreamQueryKeys.playlist(playlistId),
  });
  await persistXtreamQueryCache(queryClient);
}
