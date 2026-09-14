/* eslint-env jest */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { storage, WATCH_HISTORY_SCHEMA_VERSION } from '../src/utils/storage';
import { proxyStreamUrl } from '../src/utils/proxy';

const PLAYLIST_A = 'playlist-a';
const PLAYLIST_B = 'playlist-b';

describe('playlist-scoped watch storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    storage.setActivePlaylistId(PLAYLIST_A);
  });

  afterAll(() => {
    storage.setActivePlaylistId(null);
  });

  it('recovers valid legacy live history and discards malformed entries', async () => {
    const directUrl = 'http://example.com:80/live/user/pass/123.ts';
    const savedUrl = proxyStreamUrl(directUrl, true);
    await AsyncStorage.setItem(
      `@latest_watched:${PLAYLIST_A}`,
      JSON.stringify([
        {
          id: savedUrl,
          type: 'live',
          name: 'News',
          channelName: 'News HD',
          timestamp: 100,
        },
        {
          id: 'not-a-stream-url',
          type: 'live',
          name: 'Broken',
          timestamp: 50,
        },
      ]),
    );
    const multiGet = jest.spyOn(AsyncStorage, 'multiGet');

    const result = await storage.getWatchHistory();

    expect(multiGet).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
        id: '123',
        type: 'live',
        streamId: '123',
        containerExtension: 'ts',
        channelName: 'News HD',
      }),
    ]);

    const persisted = JSON.parse(
      (await AsyncStorage.getItem(`@watch_history:${PLAYLIST_A}`)) || '[]',
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0].schemaVersion).toBe(WATCH_HISTORY_SCHEMA_VERSION);
    expect(persisted[0].streamUrl).toBeUndefined();
  });

  it('loads latest, movie progress, and series progress in one storage request', async () => {
    await AsyncStorage.multiSet([
      [
        `@latest_watched:${PLAYLIST_A}`,
        JSON.stringify([
          {
            schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
            id: 'movie-1',
            type: 'movie',
            name: 'Movie',
            timestamp: 200,
          },
          {
            schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
            id: 'series-1',
            type: 'series',
            name: 'Series',
            seriesId: 'series-1',
            episodeId: 'episode-2',
            timestamp: 100,
          },
        ]),
      ],
      [
        `@movie_progress:${PLAYLIST_A}`,
        JSON.stringify({
          'movie-1': { progress: 45, totalDuration: 120 },
        }),
      ],
      [
        `@series_progress:${PLAYLIST_A}`,
        JSON.stringify({
          'series-1_episode-2': { progress: 60, totalDuration: 180 },
        }),
      ],
    ]);
    const multiGet = jest.spyOn(AsyncStorage, 'multiGet');

    const result = await storage.getLatestWatched();

    expect(multiGet).toHaveBeenCalledTimes(1);
    expect(multiGet).toHaveBeenCalledWith([
      `@latest_watched:${PLAYLIST_A}`,
      `@movie_progress:${PLAYLIST_A}`,
      `@series_progress:${PLAYLIST_A}`,
    ]);
    expect(result.find(item => item.type === 'movie')).toMatchObject({
      progress: 45,
      totalDuration: 120,
    });
    expect(result.find(item => item.type === 'series')).toMatchObject({
      progress: 60,
      totalDuration: 180,
    });
  });

  it('keeps history isolated between playlists', async () => {
    await storage.saveLatestWatched({
      id: 'movie-a',
      type: 'movie',
      name: 'Movie A',
      timestamp: 10,
    });

    storage.setActivePlaylistId(PLAYLIST_B);
    await storage.saveLatestWatched({
      id: 'movie-b',
      type: 'movie',
      name: 'Movie B',
      timestamp: 20,
    });
    expect((await storage.getLatestWatched()).map(item => item.id)).toEqual([
      'movie-b',
    ]);

    storage.setActivePlaylistId(PLAYLIST_A);
    expect((await storage.getLatestWatched()).map(item => item.id)).toEqual([
      'movie-a',
    ]);
  });

  it('removes only the deleted playlist data', async () => {
    await AsyncStorage.multiSet([
      [`@latest_watched:${PLAYLIST_A}`, '[]'],
      [`@movie_progress:${PLAYLIST_A}`, '{}'],
      [`@latest_watched:${PLAYLIST_B}`, '[{"id":"keep"}]'],
    ]);

    await storage.clearPlaylistData(PLAYLIST_A);

    expect(
      await AsyncStorage.getItem(`@latest_watched:${PLAYLIST_A}`),
    ).toBeNull();
    expect(
      await AsyncStorage.getItem(`@movie_progress:${PLAYLIST_A}`),
    ).toBeNull();
    expect(await AsyncStorage.getItem(`@latest_watched:${PLAYLIST_B}`)).toBe(
      '[{"id":"keep"}]',
    );
  });

  it('removes completed content from progress and Continue Watching together', async () => {
    await AsyncStorage.multiSet([
      [
        `@movie_progress:${PLAYLIST_A}`,
        JSON.stringify({
          'movie-done': { progress: 119, totalDuration: 120 },
          'movie-keep': { progress: 30, totalDuration: 120 },
        }),
      ],
      [
        `@latest_watched:${PLAYLIST_A}`,
        JSON.stringify([
          { id: 'movie-done', type: 'movie', name: 'Done', timestamp: 2 },
          { id: 'movie-keep', type: 'movie', name: 'Keep', timestamp: 1 },
        ]),
      ],
      [
        `@recently_watched:${PLAYLIST_A}`,
        JSON.stringify([
          { id: 'movie-done', type: 'movie', name: 'Done', timestamp: 2 },
        ]),
      ],
    ]);

    await storage.completeWatchProgress('movie-done', true);

    expect(await storage.getAllProgress(true)).toEqual({
      'movie-keep': { progress: 30, totalDuration: 120 },
    });
    expect((await storage.getLatestWatched()).map(item => item.id)).toEqual([
      'movie-keep',
    ]);
    expect(await storage.getWatchHistory()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'movie-done', completed: true }),
        expect.objectContaining({ id: 'movie-keep', completed: false }),
      ]),
    );
  });

  it('removes only the completed episode from series progress and history', async () => {
    await AsyncStorage.multiSet([
      [
        `@series_progress:${PLAYLIST_A}`,
        JSON.stringify({
          'series-1_episode-1': { progress: 119, totalDuration: 120 },
          'series-1_episode-2': { progress: 30, totalDuration: 120 },
        }),
      ],
      [
        `@latest_watched:${PLAYLIST_A}`,
        JSON.stringify([
          {
            id: 'series-1',
            type: 'series',
            name: 'Episode 1',
            seriesId: 'series-1',
            episodeId: 'episode-1',
            timestamp: 2,
          },
          {
            id: 'series-2',
            type: 'series',
            name: 'Other series',
            seriesId: 'series-2',
            episodeId: 'episode-9',
            timestamp: 1,
          },
        ]),
      ],
    ]);

    await storage.completeWatchProgress(
      'episode-1',
      false,
      'series-1',
      'episode-1',
    );

    expect(await storage.getAllProgress(false)).toEqual({
      'series-1_episode-2': { progress: 30, totalDuration: 120 },
    });
    expect(
      (await storage.getLatestWatched())
        .filter(item => item.type === 'series')
        .map(item => item.episodeId),
    ).toEqual(['episode-9']);
  });

  it('moves unscoped legacy data into the selected playlist once', async () => {
    await AsyncStorage.multiSet([
      [
        '@latest_watched',
        JSON.stringify([
          {
            id: 'legacy-movie',
            type: 'movie',
            name: 'Legacy movie',
            timestamp: 10,
          },
        ]),
      ],
      [
        '@movie_progress',
        JSON.stringify({
          'legacy-movie': { progress: 12, totalDuration: 90 },
        }),
      ],
    ]);

    await storage.migrateLegacyPlaylistData(PLAYLIST_A);

    expect(await AsyncStorage.getItem('@latest_watched')).toBeNull();
    expect(await AsyncStorage.getItem('@movie_progress')).toBeNull();
    expect(
      JSON.parse(
        (await AsyncStorage.getItem(`@latest_watched:${PLAYLIST_A}`)) || '[]',
      ),
    ).toEqual([
      expect.objectContaining({
        schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
        id: 'legacy-movie',
        type: 'movie',
      }),
    ]);
    expect(
      JSON.parse(
        (await AsyncStorage.getItem(`@movie_progress:${PLAYLIST_A}`)) || '{}',
      ),
    ).toHaveProperty('legacy-movie.progress', 12);
  });

  it('keeps separate permanent history entries for episodes in one series', async () => {
    await storage.saveWatchHistory({
      id: 'series-1',
      type: 'series',
      name: 'Episode 1',
      seriesId: 'series-1',
      episodeId: 'episode-1',
      timestamp: 1,
    });
    await storage.saveWatchHistory({
      id: 'series-1',
      type: 'series',
      name: 'Episode 2',
      seriesId: 'series-1',
      episodeId: 'episode-2',
      timestamp: 2,
    });

    expect(
      (await storage.getWatchHistory()).map(item =>
        item.type === 'series' ? item.episodeId : item.id,
      ),
    ).toEqual(['episode-2', 'episode-1']);
  });

  it('caps permanent history at 200 entries', async () => {
    for (let index = 0; index < 205; index += 1) {
      await storage.saveWatchHistory({
        id: `movie-${index}`,
        type: 'movie',
        name: `Movie ${index}`,
        timestamp: index,
      });
    }

    const history = await storage.getWatchHistory();
    expect(history).toHaveLength(200);
    expect(history[0].id).toBe('movie-204');
  });

  it('removes one history item and its matching progress only', async () => {
    await storage.saveWatchHistory({
      id: 'movie-remove',
      type: 'movie',
      name: 'Remove',
      streamId: 'movie-remove',
      timestamp: 2,
    });
    await storage.saveWatchHistory({
      id: 'movie-keep',
      type: 'movie',
      name: 'Keep',
      streamId: 'movie-keep',
      timestamp: 1,
    });
    await AsyncStorage.setItem(
      `@movie_progress:${PLAYLIST_A}`,
      JSON.stringify({
        'movie-remove': { progress: 20 },
        'movie-keep': { progress: 30 },
      }),
    );
    const item = (await storage.getWatchHistory())[0];

    await storage.removeHistoryEntry(item);

    expect((await storage.getWatchHistory()).map(entry => entry.id)).toEqual([
      'movie-keep',
    ]);
    expect(await storage.getAllProgress(true)).toEqual({
      'movie-keep': { progress: 30 },
    });
  });

  it('keeps favorites playlist-scoped and derives recent channels from history', async () => {
    await storage.toggleFavoriteChannel({
      streamId: '101',
      name: 'News',
      extension: 'ts',
      categoryId: '9',
    });
    await storage.saveWatchHistory({
      id: '101',
      type: 'live',
      name: 'News',
      streamId: '101',
      channelName: 'News',
      containerExtension: 'ts',
      categoryId: '9',
      timestamp: 10,
    });

    expect(await storage.getFavoriteChannels()).toEqual([
      expect.objectContaining({ streamId: '101', categoryId: '9' }),
    ]);
    expect(await storage.getRecentChannels()).toEqual([
      expect.objectContaining({ streamId: '101', lastViewedAt: 10 }),
    ]);

    storage.setActivePlaylistId(PLAYLIST_B);
    expect(await storage.getFavoriteChannels()).toEqual([]);
    expect(await storage.getRecentChannels()).toEqual([]);
  });

  it('clears history and progress without clearing favorites', async () => {
    await storage.toggleFavoriteChannel({
      streamId: '101',
      name: 'News',
      extension: 'm3u8',
    });
    await storage.saveWatchHistory({
      id: 'movie-1',
      type: 'movie',
      name: 'Movie',
      timestamp: 1,
    });
    await AsyncStorage.setItem(
      `@movie_progress:${PLAYLIST_A}`,
      JSON.stringify({ 'movie-1': { progress: 20 } }),
    );

    await storage.clearWatchHistory();

    expect(await storage.getWatchHistory()).toEqual([]);
    expect(await storage.getAllProgress(true)).toEqual({});
    expect(await storage.getFavoriteChannels()).toHaveLength(1);
  });
});
