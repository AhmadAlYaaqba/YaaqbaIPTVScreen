/* eslint-env jest */

import { QueryClient } from '@tanstack/react-query';

import {
  XTREAM_ACCOUNT_STALE_TIME_MS,
  XTREAM_CATEGORY_STALE_TIME_MS,
  XTREAM_CONTENT_STALE_TIME_MS,
  XTREAM_SERIES_DETAILS_STALE_TIME_MS,
  xtreamQueryKeys,
} from '../src/services/xtream/xtreamQueries';

describe('Xtream query keys and freshness', () => {
  it('isolates every catalog key by playlist and media identity', () => {
    expect(xtreamQueryKeys.categories('playlist-a', 'live')).toEqual([
      'xtream',
      'playlist-a',
      'live',
      'categories',
    ]);
    expect(
      xtreamQueryKeys.categoryContent('playlist-a', 'movie', 'category-2'),
    ).toEqual(['xtream', 'playlist-a', 'movie', 'category', 'category-2']);
    expect(xtreamQueryKeys.seriesDetails('playlist-a', 'series-9')).toEqual([
      'xtream',
      'playlist-a',
      'series',
      'details',
      'series-9',
    ]);
    expect(xtreamQueryKeys.categories('playlist-a', 'live')).not.toEqual(
      xtreamQueryKeys.categories('playlist-b', 'live'),
    );
    expect(xtreamQueryKeys.account('playlist-a')).toEqual([
      'xtream',
      'playlist-a',
      'account',
    ]);
    expect(xtreamQueryKeys.account('playlist-a')).not.toEqual(
      xtreamQueryKeys.account('playlist-b'),
    );
  });

  it('uses the agreed stale windows', () => {
    expect(XTREAM_CATEGORY_STALE_TIME_MS).toBe(12 * 60 * 60 * 1000);
    expect(XTREAM_CONTENT_STALE_TIME_MS).toBe(30 * 60 * 1000);
    expect(XTREAM_SERIES_DETAILS_STALE_TIME_MS).toBe(60 * 60 * 1000);
    expect(XTREAM_ACCOUNT_STALE_TIME_MS).toBe(15 * 60 * 1000);
  });

  it('keeps rapid category results in separate cache entries', () => {
    const queryClient = new QueryClient();
    const newsKey = xtreamQueryKeys.categoryContent(
      'playlist-a',
      'live',
      'news',
    );
    const sportsKey = xtreamQueryKeys.categoryContent(
      'playlist-a',
      'live',
      'sports',
    );

    queryClient.setQueryData(newsKey, [{ stream_id: 1, name: 'News One' }]);
    queryClient.setQueryData(sportsKey, [{ stream_id: 2, name: 'Sports One' }]);

    expect(queryClient.getQueryData(sportsKey)).toEqual([
      { stream_id: 2, name: 'Sports One' },
    ]);
    expect(queryClient.getQueryData(newsKey)).toEqual([
      { stream_id: 1, name: 'News One' },
    ]);
    queryClient.clear();
  });

  it('keeps account responses isolated by playlist in memory', () => {
    const queryClient = new QueryClient();
    const first = xtreamQueryKeys.account('playlist-a');
    const second = xtreamQueryKeys.account('playlist-b');

    queryClient.setQueryData(first, { planName: 'Plan A' });
    queryClient.setQueryData(second, { planName: 'Plan B' });

    expect(queryClient.getQueryData(first)).toEqual({ planName: 'Plan A' });
    expect(queryClient.getQueryData(second)).toEqual({ planName: 'Plan B' });
    queryClient.clear();
  });
});
