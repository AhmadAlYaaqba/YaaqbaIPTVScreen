import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  XtreamCategory,
  XtreamMediaType,
} from '../services/xtream/xtreamService';

const STORAGE_PREFIX = '@yaaqba/category-dropdown/v1';
const STORAGE_VERSION = 1;
const MAX_VISIBLE_CATEGORY_IDS = 32;

export const CATEGORY_DROPDOWN_ROW_HEIGHT = 48;

export interface CategoryDropdownViewport {
  anchorCategoryId: string | null;
  visibleCategoryIds: string[];
}

export interface CategoryDropdownState extends CategoryDropdownViewport {
  selectedCategoryId: string | null;
}

type StoredCategoryDropdownState = CategoryDropdownState & {
  version: typeof STORAGE_VERSION;
};

export interface CategoryDropdownScrollTarget {
  categoryId: string;
  viewPosition: 0 | 0.5;
}

const pendingWrites = new Map<string, Promise<void>>();

function normalizeId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const id = value.trim();
  return id ? id : null;
}

function normalizeVisibleIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  value.forEach(rawId => {
    const id = normalizeId(rawId);
    if (id && !seen.has(id) && ids.length < MAX_VISIBLE_CATEGORY_IDS) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
}

function normalizeState(value: unknown): CategoryDropdownState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<StoredCategoryDropdownState>;
  if (raw.version !== STORAGE_VERSION) {
    return null;
  }

  return {
    selectedCategoryId: normalizeId(raw.selectedCategoryId),
    anchorCategoryId: normalizeId(raw.anchorCategoryId),
    visibleCategoryIds: normalizeVisibleIds(raw.visibleCategoryIds),
  };
}

export function getCategoryDropdownStorageKey(
  playlistId: string,
  mediaType: XtreamMediaType,
): string {
  return `${STORAGE_PREFIX}/${encodeURIComponent(playlistId)}/${mediaType}`;
}

export async function loadCategoryDropdownState(
  playlistId: string,
  mediaType: XtreamMediaType,
): Promise<CategoryDropdownState | null> {
  const key = getCategoryDropdownStorageKey(playlistId, mediaType);
  const pendingWrite = pendingWrites.get(key);
  if (pendingWrite) {
    await pendingWrite.catch(() => undefined);
  }

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveCategoryDropdownState(
  playlistId: string,
  mediaType: XtreamMediaType,
  state: CategoryDropdownState,
): Promise<void> {
  if (!playlistId) {
    return;
  }

  const key = getCategoryDropdownStorageKey(playlistId, mediaType);
  const normalized: StoredCategoryDropdownState = {
    version: STORAGE_VERSION,
    selectedCategoryId: normalizeId(state.selectedCategoryId),
    anchorCategoryId: normalizeId(state.anchorCategoryId),
    visibleCategoryIds: normalizeVisibleIds(state.visibleCategoryIds),
  };
  const previousWrite = pendingWrites.get(key) ?? Promise.resolve();
  const write = previousWrite
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(key, JSON.stringify(normalized)));
  pendingWrites.set(key, write);

  try {
    await write;
  } finally {
    if (pendingWrites.get(key) === write) {
      pendingWrites.delete(key);
    }
  }
}

export async function removeCategoryDropdownStateForPlaylist(
  playlistId: string,
): Promise<void> {
  const keys = (['live', 'movie', 'series'] as const).map(mediaType =>
    getCategoryDropdownStorageKey(playlistId, mediaType),
  );
  await Promise.all(
    keys.map(key => pendingWrites.get(key)?.catch(() => undefined)),
  );
  await AsyncStorage.multiRemove(keys);
}

export function resolveCategoryDropdownScrollTarget(
  categories: readonly XtreamCategory[],
  selectedCategoryId: string | null,
  savedState: CategoryDropdownState | null,
): CategoryDropdownScrollTarget | null {
  if (!selectedCategoryId) {
    return null;
  }

  const availableIds = new Set(
    categories.map(category => String(category.category_id)),
  );
  if (!availableIds.has(selectedCategoryId)) {
    return null;
  }

  const savedAnchor = savedState?.anchorCategoryId ?? null;
  const selectedWasVisible =
    savedState?.visibleCategoryIds.includes(selectedCategoryId) ?? false;

  if (savedAnchor && selectedWasVisible && availableIds.has(savedAnchor)) {
    return { categoryId: savedAnchor, viewPosition: 0 };
  }

  return { categoryId: selectedCategoryId, viewPosition: 0.5 };
}

export function getCategoryDropdownFallbackOffset(index: number): number {
  return Math.max(0, index) * CATEGORY_DROPDOWN_ROW_HEIGHT;
}

export function resetCategoryDropdownStateForTests(): void {
  pendingWrites.clear();
}
