import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type {
  XtreamCategory,
  XtreamMediaType,
} from '../services/xtream/xtreamService';
import {
  CategoryDropdownState,
  CategoryDropdownViewport,
  loadCategoryDropdownState,
  removeCategoryDropdownStateForPlaylist,
  resetCategoryDropdownStateForTests,
  saveCategoryDropdownState,
} from '../utils/categoryDropdownState';

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

export async function clearCatalogViewState(playlistId: string): Promise<void> {
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
  await removeCategoryDropdownStateForPlaylist(playlistId);
}

export function resetCatalogViewStateForTests(): void {
  categorySelections.clear();
  scrollOffsets.clear();
  resetCategoryDropdownStateForTests();
}

type HydratedDropdownState = {
  contextKey: string | null;
  ready: boolean;
  value: CategoryDropdownState | null;
};

function dropdownStatesEqual(
  first: CategoryDropdownState | null,
  second: CategoryDropdownState | null,
): boolean {
  return (
    first?.selectedCategoryId === second?.selectedCategoryId &&
    first?.anchorCategoryId === second?.anchorCategoryId &&
    (first?.visibleCategoryIds.length ?? 0) ===
      (second?.visibleCategoryIds.length ?? 0) &&
    (first?.visibleCategoryIds.every(
      (categoryId, index) => categoryId === second?.visibleCategoryIds[index],
    ) ??
      true)
  );
}

function persistDropdownState(
  playlistId: string,
  mediaType: XtreamMediaType,
  state: CategoryDropdownState,
): void {
  saveCategoryDropdownState(playlistId, mediaType, state).catch(error => {
    if (__DEV__) {
      console.error('Could not save category dropdown state:', error);
    }
  });
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
  const [selection, setSelection] = useState<{
    contextKey: string | null;
    categoryId: string | null;
  }>({ contextKey: null, categoryId: null });
  const [hydratedDropdown, setHydratedDropdown] =
    useState<HydratedDropdownState>({
      contextKey: null,
      ready: false,
      value: null,
    });
  const activeCategoryId =
    selection.contextKey === contextKey ? selection.categoryId : null;
  const dropdownReady =
    hydratedDropdown.contextKey === contextKey && hydratedDropdown.ready;
  const dropdownState = dropdownReady ? hydratedDropdown.value : null;

  useEffect(() => {
    let cancelled = false;

    if (!playlistId || !contextKey) {
      setSelection({ contextKey: null, categoryId: null });
      setHydratedDropdown({ contextKey, ready: true, value: null });
      return () => {
        cancelled = true;
      };
    }

    setSelection({ contextKey, categoryId: null });
    setHydratedDropdown({ contextKey, ready: false, value: null });

    loadCategoryDropdownState(playlistId, mediaType)
      .then(savedState => {
        if (cancelled) {
          return;
        }
        const sessionSelection = getCatalogCategorySelection(
          playlistId,
          mediaType,
        );
        const value = sessionSelection
          ? {
              selectedCategoryId: sessionSelection,
              anchorCategoryId: savedState?.anchorCategoryId ?? null,
              visibleCategoryIds: savedState?.visibleCategoryIds ?? [],
            }
          : savedState;
        setHydratedDropdown({ contextKey, ready: true, value });
      })
      .catch(() => {
        if (!cancelled) {
          setHydratedDropdown({ contextKey, ready: true, value: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [contextKey, mediaType, playlistId]);

  useEffect(() => {
    if (!categoriesReady || !playlistId || !contextKey || !dropdownReady) {
      return;
    }

    const availableIds = new Set(
      categories.map(category => String(category.category_id)),
    );
    const sessionSelection = getCatalogCategorySelection(playlistId, mediaType);
    const candidate =
      activeCategoryId ?? sessionSelection ?? dropdownState?.selectedCategoryId;
    const nextCategoryId =
      candidate && availableIds.has(candidate)
        ? candidate
        : categories[0]
        ? String(categories[0].category_id)
        : null;

    if (nextCategoryId) {
      saveCatalogCategorySelection(playlistId, mediaType, nextCategoryId);
    } else {
      categorySelections.delete(contextKey);
    }
    setSelection(current =>
      current.contextKey === contextKey && current.categoryId === nextCategoryId
        ? current
        : { contextKey, categoryId: nextCategoryId },
    );

    const normalizedDropdown: CategoryDropdownState = {
      selectedCategoryId: nextCategoryId,
      anchorCategoryId:
        dropdownState?.anchorCategoryId &&
        availableIds.has(dropdownState.anchorCategoryId)
          ? dropdownState.anchorCategoryId
          : null,
      visibleCategoryIds:
        dropdownState?.visibleCategoryIds.filter(categoryId =>
          availableIds.has(categoryId),
        ) ?? [],
    };

    if (!dropdownStatesEqual(dropdownState, normalizedDropdown)) {
      setHydratedDropdown({
        contextKey,
        ready: true,
        value: normalizedDropdown,
      });
      persistDropdownState(playlistId, mediaType, normalizedDropdown);
    }
  }, [
    activeCategoryId,
    categories,
    categoriesReady,
    contextKey,
    dropdownReady,
    dropdownState,
    mediaType,
    playlistId,
  ]);

  const selectCategory = useCallback(
    (categoryId: string, viewport?: CategoryDropdownViewport) => {
      if (!playlistId || !contextKey || !categoryId) {
        return;
      }
      saveCatalogCategorySelection(playlistId, mediaType, categoryId);
      setSelection({ contextKey, categoryId });

      const nextDropdown: CategoryDropdownState = {
        selectedCategoryId: categoryId,
        anchorCategoryId:
          viewport?.anchorCategoryId ?? dropdownState?.anchorCategoryId ?? null,
        visibleCategoryIds:
          viewport?.visibleCategoryIds ??
          dropdownState?.visibleCategoryIds ??
          [],
      };
      setHydratedDropdown({
        contextKey,
        ready: true,
        value: nextDropdown,
      });
      persistDropdownState(playlistId, mediaType, nextDropdown);
    },
    [contextKey, dropdownState, mediaType, playlistId],
  );

  const commitDropdownViewport = useCallback(
    (viewport: CategoryDropdownViewport) => {
      if (!playlistId || !contextKey || !activeCategoryId) {
        return;
      }
      const nextDropdown: CategoryDropdownState = {
        selectedCategoryId: activeCategoryId,
        anchorCategoryId: viewport.anchorCategoryId,
        visibleCategoryIds: viewport.visibleCategoryIds,
      };
      setHydratedDropdown({
        contextKey,
        ready: true,
        value: nextDropdown,
      });
      persistDropdownState(playlistId, mediaType, nextDropdown);
    },
    [activeCategoryId, contextKey, mediaType, playlistId],
  );

  const activeCategoryName = useMemo(
    () =>
      categories.find(category => category.category_id === activeCategoryId)
        ?.category_name ?? '',
    [activeCategoryId, categories],
  );

  const contentOffset = useMemo(
    () => ({
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
    dropdownState,
    commitDropdownViewport,
    contentOffset,
    onScroll,
    listKey: `${playlistId ?? 'no-playlist'}:${mediaType}:${
      activeCategoryId ?? 'none'
    }`,
  };
}
