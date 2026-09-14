/* eslint-env jest */

import {
  historyEntryToPlaybackRequest,
  playbackRequestToHistoryInput,
} from '../src/utils/historyPlayback';
import { filterWatchHistory } from '../src/utils/historyFilters';
import type {
  MovieHistoryEntry,
  SeriesHistoryEntry,
} from '../src/utils/storage';

describe('watch history playback mapping', () => {
  it('stores identifiers and display metadata without a playback URL', () => {
    const entry = playbackRequestToHistoryInput(
      {
        kind: 'episode',
        streamId: 'episode-4',
        extension: 'mkv',
        title: 'The Return',
        thumbnail: 'https://images.example/still.jpg',
        seriesId: 'series-2',
        seriesName: 'Example Series',
        seasonNumber: 2,
        episodeNumber: 4,
      },
      120,
      1800,
      50,
    );

    expect(entry).toMatchObject({
      type: 'series',
      seriesId: 'series-2',
      episodeId: 'episode-4',
      seriesName: 'Example Series',
      seasonNumber: 2,
      episodeNumber: 4,
      progress: 120,
      totalDuration: 1800,
    });
    expect(entry).not.toHaveProperty('streamUrl');
  });

  it('restores an incomplete episode and starts a completed one from zero', () => {
    const entry: SeriesHistoryEntry = {
      schemaVersion: 3,
      id: 'series-2',
      type: 'series',
      seriesId: 'series-2',
      episodeId: 'episode-4',
      seriesName: 'Example Series',
      episodeName: 'The Return',
      name: 'The Return',
      containerExtension: 'mkv',
      timestamp: 50,
      completed: false,
      progress: 120,
      totalDuration: 1800,
    };

    expect(historyEntryToPlaybackRequest(entry)).toMatchObject({
      kind: 'episode',
      streamId: 'episode-4',
      resume: { progress: 120, totalDuration: 1800 },
    });
    expect(
      historyEntryToPlaybackRequest({ ...entry, completed: true }),
    ).not.toHaveProperty('resume');
  });

  it('filters the permanent history without changing its order', () => {
    const movie: MovieHistoryEntry = {
      schemaVersion: 3,
      id: 'movie-1',
      type: 'movie',
      streamId: 'movie-1',
      name: 'Movie',
      containerExtension: 'mp4',
      timestamp: 20,
      completed: true,
    };
    const episode: SeriesHistoryEntry = {
      schemaVersion: 3,
      id: 'series-1',
      type: 'series',
      seriesId: 'series-1',
      episodeId: 'episode-1',
      name: 'Episode',
      containerExtension: 'mkv',
      timestamp: 10,
      completed: false,
    };

    expect(filterWatchHistory([movie, episode], 'all')).toEqual([
      movie,
      episode,
    ]);
    expect(filterWatchHistory([movie, episode], 'series')).toEqual([episode]);
  });
});
