/* eslint-env jest */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  storage,
  WATCH_HISTORY_SCHEMA_VERSION,
} from '../src/utils/storage';
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

    const result = await storage.getLatestWatched();

    expect(multiGet).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
        id: '123',
        type: 'live',
        streamId: '123',
        streamUrl: savedUrl,
        containerExtension: 'ts',
        channelName: 'News HD',
      }),
    ]);

    const persisted = JSON.parse(
      (await AsyncStorage.getItem(`@latest_watched:${PLAYLIST_A}`)) || '[]',
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0].schemaVersion).toBe(WATCH_HISTORY_SCHEMA_VERSION);
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

    expect(await AsyncStorage.getItem(`@latest_watched:${PLAYLIST_A}`)).toBeNull();
    expect(await AsyncStorage.getItem(`@movie_progress:${PLAYLIST_A}`)).toBeNull();
    expect(await AsyncStorage.getItem(`@latest_watched:${PLAYLIST_B}`)).toBe(
      '[{"id":"keep"}]',
    );
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
});
