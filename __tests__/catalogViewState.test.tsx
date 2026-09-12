/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {
  clearCatalogViewState,
  getCatalogCategorySelection,
  getCatalogScrollOffset,
  resetCatalogViewStateForTests,
  saveCatalogCategorySelection,
  saveCatalogScrollOffset,
  useCatalogViewState,
} from '../src/hooks/useCatalogViewState';
import type { XtreamCategory } from '../src/services/xtream/xtreamService';

const categories: XtreamCategory[] = [
  { category_id: 'news', category_name: 'News' },
  { category_id: 'sports', category_name: 'Sports' },
  { category_id: 'kids', category_name: 'Kids' },
];

describe('catalog session view state', () => {
  beforeEach(() => {
    resetCatalogViewStateForTests();
  });

  it('keeps selections and scroll offsets isolated by playlist and category', () => {
    saveCatalogCategorySelection('playlist-a', 'live', 'sports');
    saveCatalogCategorySelection('playlist-b', 'live', 'kids');
    saveCatalogScrollOffset('playlist-a', 'live', 'sports', 420);
    saveCatalogScrollOffset('playlist-a', 'live', 'news', 120);
    saveCatalogScrollOffset('playlist-b', 'live', 'sports', 900);

    expect(getCatalogCategorySelection('playlist-a', 'live')).toBe('sports');
    expect(getCatalogCategorySelection('playlist-b', 'live')).toBe('kids');
    expect(getCatalogScrollOffset('playlist-a', 'live', 'sports')).toBe(420);
    expect(getCatalogScrollOffset('playlist-a', 'live', 'news')).toBe(120);
    expect(getCatalogScrollOffset('playlist-b', 'live', 'sports')).toBe(900);
  });

  it('clears only the deleted playlist and sanitizes invalid offsets', () => {
    saveCatalogCategorySelection('playlist-a', 'movie', 'action');
    saveCatalogCategorySelection('playlist-b', 'movie', 'drama');
    saveCatalogScrollOffset('playlist-a', 'movie', 'action', -50);
    saveCatalogScrollOffset('playlist-a', 'movie', 'action', Number.NaN);
    saveCatalogScrollOffset('playlist-b', 'movie', 'drama', 80);

    expect(getCatalogScrollOffset('playlist-a', 'movie', 'action')).toBe(0);

    clearCatalogViewState('playlist-a');

    expect(getCatalogCategorySelection('playlist-a', 'movie')).toBeNull();
    expect(getCatalogScrollOffset('playlist-a', 'movie', 'action')).toBe(0);
    expect(getCatalogCategorySelection('playlist-b', 'movie')).toBe('drama');
    expect(getCatalogScrollOffset('playlist-b', 'movie', 'drama')).toBe(80);
  });

  it('does not reuse the previous playlist selection when IDs overlap', () => {
    saveCatalogCategorySelection('playlist-a', 'live', 'sports');
    saveCatalogCategorySelection('playlist-b', 'live', 'kids');

    let latest: ReturnType<typeof useCatalogViewState> | null = null;
    const Probe = ({ playlistId }: { playlistId: string }) => {
      latest = useCatalogViewState({
        playlistId,
        mediaType: 'live',
        categories,
        categoriesReady: true,
      });
      return null;
    };
    const getLatest = () => {
      if (!latest) {
        throw new Error('Catalog state was not rendered');
      }
      return latest;
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Probe playlistId="playlist-a" />);
    });
    expect(getLatest().activeCategoryId).toBe('sports');

    ReactTestRenderer.act(() => {
      renderer.update(<Probe playlistId="playlist-b" />);
    });
    expect(getLatest().activeCategoryId).toBe('kids');

    ReactTestRenderer.act(() => renderer.unmount());
  });
});
