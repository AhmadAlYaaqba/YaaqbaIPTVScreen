/* eslint-env jest */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

import { xtreamQueryKeys } from '../src/services/xtream/xtreamQueries';
import {
  createXtreamSnapshot,
  hydrateXtreamQueryCache,
  persistXtreamQueryCache,
  removeXtreamPlaylistCache,
  utf8ByteLength,
  XTREAM_PERSISTENCE_KEY,
  XTREAM_PERSISTENCE_MAX_AGE_MS,
  XTREAM_PERSISTENCE_VERSION,
} from '../src/services/xtream/xtreamPersistence';

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

describe('Xtream query persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('expires entries older than 24 hours', () => {
    const now = 2_000_000_000_000;
    const snapshot = createXtreamSnapshot(
      [
        {
          queryKey: xtreamQueryKeys.categories('old', 'live'),
          data: ['expired'],
          dataUpdatedAt: now - XTREAM_PERSISTENCE_MAX_AGE_MS - 1,
        },
        {
          queryKey: xtreamQueryKeys.categories('new', 'live'),
          data: ['fresh'],
          dataUpdatedAt: now - 1,
        },
      ],
      now,
    );

    expect(JSON.parse(snapshot || '{}').entries).toEqual([
      expect.objectContaining({
        queryKey: xtreamQueryKeys.categories('new', 'live'),
      }),
    ]);
  });

  it('evicts the oldest entries first to honor the snapshot cap', () => {
    const now = 2_000_000_000_000;
    const entries = [
      {
        queryKey: xtreamQueryKeys.categoryContent('playlist', 'live', 'old'),
        data: 'o'.repeat(200),
        dataUpdatedAt: now - 300,
      },
      {
        queryKey: xtreamQueryKeys.categoryContent('playlist', 'live', 'middle'),
        data: 'm'.repeat(200),
        dataUpdatedAt: now - 200,
      },
      {
        queryKey: xtreamQueryKeys.categoryContent('playlist', 'live', 'new'),
        data: 'n'.repeat(200),
        dataUpdatedAt: now - 100,
      },
    ];
    const newestTwo = createXtreamSnapshot(entries.slice(1), now)!;

    const capped = createXtreamSnapshot(
      entries,
      now,
      utf8ByteLength(newestTwo),
    );
    const ids = JSON.parse(capped || '{}').entries.map(
      (entry: { queryKey: unknown[] }) => entry.queryKey.at(-1),
    );

    expect(ids).toEqual(['middle', 'new']);
  });

  it('persists only successful Xtream data and restores its update time', async () => {
    const source = createClient();
    const target = createClient();
    const updatedAt = Date.now() - 1000;
    const key = xtreamQueryKeys.categories('playlist-a', 'movie');
    source.setQueryData(key, [{ category_id: '1' }], { updatedAt });
    source.setQueryData(['tmdb', 'movie', '1'], { title: 'Not persisted' });
    await source.prefetchQuery({
      queryKey: xtreamQueryKeys.categories('failed-playlist', 'series'),
      queryFn: () => Promise.reject(new Error('expected test failure')),
      retry: false,
    });

    await persistXtreamQueryCache(source);
    await hydrateXtreamQueryCache(target);

    expect(target.getQueryData(key)).toEqual([{ category_id: '1' }]);
    expect(target.getQueryState(key)?.dataUpdatedAt).toBe(updatedAt);
    expect(target.getQueryData(['tmdb', 'movie', '1'])).toBeUndefined();
    expect(
      target.getQueryData(
        xtreamQueryKeys.categories('failed-playlist', 'series'),
      ),
    ).toBeUndefined();
  });

  it('removes only the deleted playlist from memory and disk', async () => {
    const client = createClient();
    const playlistAKey = xtreamQueryKeys.categories('playlist-a', 'live');
    const playlistBKey = xtreamQueryKeys.categories('playlist-b', 'live');
    client.setQueryData(playlistAKey, ['remove']);
    client.setQueryData(playlistBKey, ['keep']);
    client.setQueryData(['tmdb', 'keep'], ['keep']);

    await removeXtreamPlaylistCache(client, 'playlist-a');

    expect(client.getQueryData(playlistAKey)).toBeUndefined();
    expect(client.getQueryData(playlistBKey)).toEqual(['keep']);
    expect(client.getQueryData(['tmdb', 'keep'])).toEqual(['keep']);
    const persisted = JSON.parse(
      (await AsyncStorage.getItem(XTREAM_PERSISTENCE_KEY)) || '{}',
    );
    expect(persisted.version).toBe(XTREAM_PERSISTENCE_VERSION);
    expect(persisted.entries).toEqual([
      expect.objectContaining({ queryKey: playlistBKey }),
    ]);
  });
});
