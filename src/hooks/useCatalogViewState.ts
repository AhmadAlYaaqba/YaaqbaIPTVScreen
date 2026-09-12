import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import type {
  XtreamCategory,
  XtreamMediaType,
} from '../services/xtream/xtreamService';

const categorySelections = new Map<string, string>();
const scrollOffsets = new Map<string, number>();

function catalogKey(playlistId: string, mediaType: XtreamMediaType): string {
  return `${playlistId}:${mediaType}`;
}

function categoryKey(
  playlistId: string,
  mediaType: XtreamMediaType,
  categoryId: string,
): string {
  return `${catalogKey(playlistId, mediaType)}:${categoryId}`;
}

export function getCatalogCategorySelection(
  playlistId: string,
  mediaType: XtreamMediaType,
): string | null {
  return categorySelections.get(catalogKey(playlistId, mediaType)) ?? null;
}

export function saveCatalogCategorySelection(
  playlistId: string,
  mediaType: XtreamMediaType,
  categoryId: string,
): void {
  if (playlistId && categoryId) {
    categorySelections.set(catalogKey(playlistId, mediaType), categoryId);
  }
}

export function getCatalogScrollOffset(
  playlistId: string,
  mediaType: XtreamMediaType,
  categoryId: string,
): number {
  return scrollOffsets.get(categoryKey(playlistId, mediaType, categoryId)) ?? 0;
}

export function saveCatalogScrollOffset(
  playlistId: string,
  mediaType: XtreamMediaType,
  categoryId: string,
  offset: number,
): void {
  if (playlistId && categoryId && Number.isFinite(offset)) {
    scrollOffsets.set(
      categoryKey(playlistId, mediaType, categoryId),
      Math.max(0, offset),
    );
  }
}

export function clearCatalogViewState(playlistId: string): void {
  const prefix = `${playlistId}:`;
  [...categorySelections.keys()].forEach(key => {
    if (key.startsWith(prefix)) {
      categorySelections.delete(key);
    }
  });
  [...scrollOffsets.keys()].forEach(key => {
    if (key.startsWith(prefix)) {
      scrollOffsets.delete(key);
    }
  });
}

export function resetCatalogViewStateForTests(): void {
  categorySelections.clear();
  scrollOffsets.clear();
}

export function useCatalogViewState({
  playlistId,
  mediaType,
  categories,
  categoriesReady,
}: {
  playlistId: string | null;
  mediaType: XtreamMediaType;
  categories: XtreamCategory[];
  categoriesReady: boolean;
}) {
  const contextKey = playlistId ? catalogKey(playlistId, mediaType) : null;
  const storedSelection = playlistId
    ? getCatalogCategorySelection(playlistId, mediaType)
    : null;
  const [selection, setSelection] = useState<{
    contextKey: string | null;
    categoryId: string | null;
  }>(() => ({
    contextKey,
    categoryId: storedSelection,
  }));
  const activeCategoryId =
    selection.contextKey === contextKey
      ? selection.categoryId
      : storedSelection;

  useEffect(() => {
    if (!categoriesReady || !playlistId) {
      return;
    }

    const candidate = activeCategoryId;
    const nextCategoryId = categories.some(
      category => category.category_id === candidate,
    )
      ? candidate
      : categories[0]?.category_id ?? null;

    if (nextCategoryId && nextCategoryId !== storedSelection) {
      saveCatalogCategorySelection(playlistId, mediaType, nextCategoryId);
    }
    setSelection(current =>
      current.contextKey === contextKey &&
      current.categoryId === nextCategoryId
        ? current
        : { contextKey, categoryId: nextCategoryId },
    );
  }, [
    activeCategoryId,
    categories,
    categoriesReady,
    contextKey,
    mediaType,
    playlistId,
    storedSelection,
  ]);

  const selectCategory = useCallback(
    (categoryId: string) => {
      if (!playlistId || categoryId === activeCategoryId) {
        return;
      }
      saveCatalogCategorySelection(playlistId, mediaType, categoryId);
      setSelection({ contextKey, categoryId });
    },
    [activeCategoryId, contextKey, mediaType, playlistId],
  );

  const activeCategoryName =
    categories.find(category => category.category_id === activeCategoryId)
      ?.category_name ?? '';

  const contentOffset = useMemo(
    () =>
      ({
        x: 0,
        y:
          playlistId && activeCategoryId
            ? getCatalogScrollOffset(playlistId, mediaType, activeCategoryId)
            : 0,
      }),
    [activeCategoryId, mediaType, playlistId],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (playlistId && activeCategoryId) {
        saveCatalogScrollOffset(
          playlistId,
          mediaType,
          activeCategoryId,
          event.nativeEvent.contentOffset.y,
        );
      }
    },
    [activeCategoryId, mediaType, playlistId],
  );

  return {
    activeCategoryId,
    activeCategoryName,
    selectCategory,
    contentOffset,
    onScroll,
    listKey: `${playlistId ?? 'no-playlist'}:${mediaType}:${activeCategoryId ?? 'none'}`,
  };
}
