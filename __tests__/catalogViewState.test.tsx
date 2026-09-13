/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import {
  loadCategoryDropdownState,
  saveCategoryDropdownState,
} from '../src/utils/categoryDropdownState';

const categories: XtreamCategory[] = [
  { category_id: 'news', category_name: 'News' },
  { category_id: 'sports', category_name: 'Sports' },
  { category_id: 'kids', category_name: 'Kids' },
];

describe('catalog session view state', () => {
  beforeEach(async () => {
    resetCatalogViewStateForTests();
    await AsyncStorage.clear();
  });

  const flushAsyncEffects = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };

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

  it('clears only the deleted playlist and sanitizes invalid offsets', async () => {
    saveCatalogCategorySelection('playlist-a', 'movie', 'action');
    saveCatalogCategorySelection('playlist-b', 'movie', 'drama');
    saveCatalogScrollOffset('playlist-a', 'movie', 'action', -50);
    saveCatalogScrollOffset('playlist-a', 'movie', 'action', Number.NaN);
    saveCatalogScrollOffset('playlist-b', 'movie', 'drama', 80);

    expect(getCatalogScrollOffset('playlist-a', 'movie', 'action')).toBe(0);

    await clearCatalogViewState('playlist-a');

    expect(getCatalogCategorySelection('playlist-a', 'movie')).toBeNull();
    expect(getCatalogScrollOffset('playlist-a', 'movie', 'action')).toBe(0);
    expect(getCatalogCategorySelection('playlist-b', 'movie')).toBe('drama');
    expect(getCatalogScrollOffset('playlist-b', 'movie', 'drama')).toBe(80);
  });

  it('hydrates a saved selection before choosing the first category', async () => {
    await saveCategoryDropdownState('playlist-a', 'live', {
      selectedCategoryId: 'sports',
      anchorCategoryId: 'news',
      visibleCategoryIds: ['news', 'sports'],
    });

    let latest: ReturnType<typeof useCatalogViewState> | null = null;
    const Probe = () => {
      latest = useCatalogViewState({
        playlistId: 'playlist-a',
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
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Probe />);
      await flushAsyncEffects();
    });

    expect(getLatest().activeCategoryId).toBe('sports');
    expect(getLatest().dropdownState).toMatchObject({
      selectedCategoryId: 'sports',
      anchorCategoryId: 'news',
    });

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('falls back to the first category when the saved category was deleted', async () => {
    await saveCategoryDropdownState('playlist-a', 'series', {
      selectedCategoryId: 'deleted',
      anchorCategoryId: 'deleted',
      visibleCategoryIds: ['deleted'],
    });

    let latest: ReturnType<typeof useCatalogViewState> | null = null;
    const Probe = () => {
      latest = useCatalogViewState({
        playlistId: 'playlist-a',
        mediaType: 'series',
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
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Probe />);
      await flushAsyncEffects();
    });

    expect(getLatest().activeCategoryId).toBe('news');
    await expect(
      loadCategoryDropdownState('playlist-a', 'series'),
    ).resolves.toEqual({
      selectedCategoryId: 'news',
      anchorCategoryId: null,
      visibleCategoryIds: [],
    });

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('does not reuse the previous playlist selection when IDs overlap', async () => {
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
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Probe playlistId="playlist-a" />);
      await flushAsyncEffects();
    });
    expect(getLatest().activeCategoryId).toBe('sports');

    await ReactTestRenderer.act(async () => {
      renderer.update(<Probe playlistId="playlist-b" />);
      await flushAsyncEffects();
    });
    expect(getLatest().activeCategoryId).toBe('kids');

    ReactTestRenderer.act(() => renderer.unmount());
  });
});
