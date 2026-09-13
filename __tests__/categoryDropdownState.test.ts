/* eslint-env jest */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CATEGORY_DROPDOWN_ROW_HEIGHT,
  getCategoryDropdownFallbackOffset,
  getCategoryDropdownStorageKey,
  loadCategoryDropdownState,
  removeCategoryDropdownStateForPlaylist,
  resetCategoryDropdownStateForTests,
  resolveCategoryDropdownScrollTarget,
  saveCategoryDropdownState,
} from '../src/utils/categoryDropdownState';
import type { XtreamCategory } from '../src/services/xtream/xtreamService';

const categories: XtreamCategory[] = [
  { category_id: 'news', category_name: 'News' },
  { category_id: 'sports', category_name: 'Sports' },
  { category_id: 'kids', category_name: 'Kids' },
  { category_id: 'movies', category_name: 'Movies' },
];

describe('persisted category dropdown state', () => {
  beforeEach(async () => {
    resetCategoryDropdownStateForTests();
    await AsyncStorage.clear();
  });

  it('keeps selection and position isolated by playlist and media tab', async () => {
    await saveCategoryDropdownState('playlist-a', 'live', {
      selectedCategoryId: 'sports',
      anchorCategoryId: 'news',
      visibleCategoryIds: ['news', 'sports'],
    });
    await saveCategoryDropdownState('playlist-a', 'movie', {
      selectedCategoryId: 'movies',
      anchorCategoryId: 'movies',
      visibleCategoryIds: ['movies'],
    });
    await saveCategoryDropdownState('playlist-b', 'live', {
      selectedCategoryId: 'kids',
      anchorCategoryId: 'kids',
      visibleCategoryIds: ['kids'],
    });

    await expect(
      loadCategoryDropdownState('playlist-a', 'live'),
    ).resolves.toEqual({
      selectedCategoryId: 'sports',
      anchorCategoryId: 'news',
      visibleCategoryIds: ['news', 'sports'],
    });
    await expect(
      loadCategoryDropdownState('playlist-a', 'movie'),
    ).resolves.toEqual({
      selectedCategoryId: 'movies',
      anchorCategoryId: 'movies',
      visibleCategoryIds: ['movies'],
    });
    await expect(
      loadCategoryDropdownState('playlist-b', 'live'),
    ).resolves.toEqual({
      selectedCategoryId: 'kids',
      anchorCategoryId: 'kids',
      visibleCategoryIds: ['kids'],
    });
  });

  it('removes only the deleted playlist state', async () => {
    await saveCategoryDropdownState('playlist-a', 'series', {
      selectedCategoryId: 'kids',
      anchorCategoryId: 'sports',
      visibleCategoryIds: ['sports', 'kids'],
    });
    await saveCategoryDropdownState('playlist-b', 'series', {
      selectedCategoryId: 'news',
      anchorCategoryId: 'news',
      visibleCategoryIds: ['news'],
    });

    await removeCategoryDropdownStateForPlaylist('playlist-a');

    await expect(
      loadCategoryDropdownState('playlist-a', 'series'),
    ).resolves.toBeNull();
    await expect(
      loadCategoryDropdownState('playlist-b', 'series'),
    ).resolves.toMatchObject({
      selectedCategoryId: 'news',
    });
  });

  it('stores category identities without raw list indices', async () => {
    await saveCategoryDropdownState('playlist-a', 'live', {
      selectedCategoryId: 'sports',
      anchorCategoryId: 'news',
      visibleCategoryIds: ['news', 'sports', 'sports', ''],
    });

    const raw = await AsyncStorage.getItem(
      getCategoryDropdownStorageKey('playlist-a', 'live'),
    );
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({
      version: 1,
      selectedCategoryId: 'sports',
      anchorCategoryId: 'news',
      visibleCategoryIds: ['news', 'sports'],
    });
    expect(raw).not.toContain('index');
  });

  it('restores the saved anchor only when it keeps the selection visible', () => {
    expect(
      resolveCategoryDropdownScrollTarget(categories, 'sports', {
        selectedCategoryId: 'sports',
        anchorCategoryId: 'news',
        visibleCategoryIds: ['news', 'sports', 'kids'],
      }),
    ).toEqual({ categoryId: 'news', viewPosition: 0 });

    expect(
      resolveCategoryDropdownScrollTarget(categories, 'movies', {
        selectedCategoryId: 'movies',
        anchorCategoryId: 'news',
        visibleCategoryIds: ['news', 'sports'],
      }),
    ).toEqual({ categoryId: 'movies', viewPosition: 0.5 });
  });

  it('ignores deleted targets and calculates a safe failed-scroll offset', () => {
    expect(
      resolveCategoryDropdownScrollTarget(categories, 'deleted', {
        selectedCategoryId: 'deleted',
        anchorCategoryId: 'news',
        visibleCategoryIds: ['news', 'deleted'],
      }),
    ).toBeNull();
    expect(getCategoryDropdownFallbackOffset(7)).toBe(
      7 * CATEGORY_DROPDOWN_ROW_HEIGHT,
    );
    expect(getCategoryDropdownFallbackOffset(-2)).toBe(0);
  });
});
