import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Platform,
  Modal,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import AppIcon, { type AppIconName } from '../AppIcon';

import { colors, radii } from '../../theme/colors';
import {
  CATEGORY_DROPDOWN_ROW_HEIGHT,
  CategoryDropdownState,
  CategoryDropdownViewport,
  getCategoryDropdownFallbackOffset,
  resolveCategoryDropdownScrollTarget,
} from '../../utils/categoryDropdownState';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });

export type DropdownCategory = {
  category_id: string;
  category_name: string;
};

interface CategoryDropdownProps {
  label: string;
  categories: DropdownCategory[];
  activeCategoryId: string | null;
  activeCategoryName: string;
  onSelect: (
    categoryId: string,
    categoryName: string,
    viewport: CategoryDropdownViewport,
  ) => void;
  restorationState?: CategoryDropdownState | null;
  onPositionCommit?: (viewport: CategoryDropdownViewport) => void;
  accent?: string;
  icon?: AppIconName;
  searchPlaceholder?: string;
  onSearchToggle?: () => void;
  searchActive?: boolean;
  onBack?: () => void;
}

const EMPTY_VIEWPORT: CategoryDropdownViewport = {
  anchorCategoryId: null,
  visibleCategoryIds: [],
};

const CategoryRow = memo(
  ({
    item,
    active,
    accent,
    onSelect,
  }: {
    item: DropdownCategory;
    active: boolean;
    accent: string;
    onSelect: (category: DropdownCategory) => void;
  }) => {
    const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
    const activeStyle = useMemo(
      () => (active ? { backgroundColor: `${accent}1f` } : null),
      [accent, active],
    );

    return (
      <Pressable
        onPress={handlePress}
        style={[styles.row, activeStyle]}
        accessibilityRole="button"
        accessibilityLabel={item.category_name}
        accessibilityState={{ selected: active }}>
        <Text
          style={[styles.rowText, active && styles.rowTextActive]}
          numberOfLines={1}>
          {item.category_name}
        </Text>
        {active && <AppIcon name="check" size={13} color={accent} />}
      </Pressable>
    );
  },
);

// ─────────────────────────────────────────────────────────────
// Reusable Mirror category switcher — header trigger + searchable
// overlay panel. Used by Live TV (and, later, Movies / Series).
// ─────────────────────────────────────────────────────────────
export default function CategoryDropdown({
  label,
  categories,
  activeCategoryId,
  activeCategoryName,
  onSelect,
  restorationState = null,
  onPositionCommit,
  accent = colors.magentaOnAir,
  icon = 'layer-group',
  searchPlaceholder = 'Search categories',
  onSearchToggle,
  searchActive = false,
  onBack,
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelTop, setPanelTop] = useState(0);
  const headerRef = useRef<View>(null);
  const listRef = useRef<FlatList<DropdownCategory>>(null);
  const queryRef = useRef('');
  const normalViewportRef = useRef<CategoryDropdownViewport>(EMPTY_VIEWPORT);
  const failedScrollRetriedRef = useRef(false);
  const suppressViewabilityRef = useRef(false);
  const restorationViewportRef =
    useRef<CategoryDropdownViewport>(EMPTY_VIEWPORT);
  const lastScrollTargetRef = useRef<{
    index: number;
    viewPosition: 0 | 0.5;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      queryRef.current = '';
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      normalViewportRef.current = restorationState
        ? {
            anchorCategoryId: restorationState.anchorCategoryId,
            visibleCategoryIds: [...restorationState.visibleCategoryIds],
          }
        : EMPTY_VIEWPORT;
    }
  }, [open, restorationState]);

  const safeCategories = useMemo(
    () => (Array.isArray(categories) ? categories : []),
    [categories],
  );

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalized
        ? safeCategories.filter(c =>
            c.category_name?.toLowerCase().includes(normalized),
          )
        : safeCategories,
    [normalized, safeCategories],
  );

  const commitPosition = useCallback(() => {
    onPositionCommit?.({
      anchorCategoryId: normalViewportRef.current.anchorCategoryId,
      visibleCategoryIds: [...normalViewportRef.current.visibleCategoryIds],
    });
  }, [onPositionCommit]);

  const closeDropdown = useCallback(() => {
    commitPosition();
    setOpen(false);
  }, [commitPosition]);

  const toggleOpen = useCallback(() => {
    if (open) {
      closeDropdown();
      return;
    }
    headerRef.current?.measureInWindow((_x, y, _w, h) => {
      failedScrollRetriedRef.current = false;
      suppressViewabilityRef.current = true;
      restorationViewportRef.current = {
        anchorCategoryId: normalViewportRef.current.anchorCategoryId,
        visibleCategoryIds: [...normalViewportRef.current.visibleCategoryIds],
      };
      setPanelTop(y + h + 2);
      setOpen(true);
    });
  }, [closeDropdown, open]);

  const handleSelect = useCallback(
    (category: DropdownCategory) => {
      onSelect(category.category_id, category.category_name, {
        anchorCategoryId: normalViewportRef.current.anchorCategoryId,
        visibleCategoryIds: [...normalViewportRef.current.visibleCategoryIds],
      });
      setOpen(false);
    },
    [onSelect],
  );

  const handleQueryChange = useCallback((value: string) => {
    const wasSearching = Boolean(queryRef.current.trim());
    const willSearch = Boolean(value.trim());
    if (wasSearching && !willSearch) {
      suppressViewabilityRef.current = true;
      restorationViewportRef.current = {
        anchorCategoryId: normalViewportRef.current.anchorCategoryId,
        visibleCategoryIds: [...normalViewportRef.current.visibleCategoryIds],
      };
    }
    queryRef.current = value;
    setQuery(value);
  }, []);

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (queryRef.current.trim() || suppressViewabilityRef.current) {
        return;
      }
      const visibleCategoryIds = viewableItems
        .filter(token => token.isViewable && token.item)
        .sort((first, second) => (first.index ?? 0) - (second.index ?? 0))
        .map(token => String((token.item as DropdownCategory).category_id));

      normalViewportRef.current = {
        anchorCategoryId: visibleCategoryIds[0] ?? null,
        visibleCategoryIds,
      };
    },
  ).current;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const restoreListPosition = useCallback(() => {
    if (!open || normalized || safeCategories.length === 0) {
      return;
    }
    const target = resolveCategoryDropdownScrollTarget(
      safeCategories,
      activeCategoryId,
      {
        selectedCategoryId: activeCategoryId,
        anchorCategoryId: restorationViewportRef.current.anchorCategoryId,
        visibleCategoryIds: restorationViewportRef.current.visibleCategoryIds,
      },
    );
    if (!target) {
      suppressViewabilityRef.current = false;
      return;
    }
    const index = safeCategories.findIndex(
      category => category.category_id === target.categoryId,
    );
    if (index < 0) {
      suppressViewabilityRef.current = false;
      return;
    }
    lastScrollTargetRef.current = {
      index,
      viewPosition: target.viewPosition,
    };
    listRef.current?.scrollToIndex({
      index,
      animated: false,
      viewPosition: target.viewPosition,
    });
    requestAnimationFrame(() => {
      suppressViewabilityRef.current = false;
    });
  }, [activeCategoryId, normalized, open, safeCategories]);

  useEffect(() => {
    if (!open || normalized) {
      return;
    }
    const frame = requestAnimationFrame(restoreListPosition);
    return () => cancelAnimationFrame(frame);
  }, [normalized, open, restoreListPosition]);

  const handleScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      listRef.current?.scrollToOffset({
        animated: false,
        offset: getCategoryDropdownFallbackOffset(index),
      });
      if (failedScrollRetriedRef.current) {
        return;
      }
      failedScrollRetriedRef.current = true;
      requestAnimationFrame(() => {
        const target = lastScrollTargetRef.current;
        if (!target) {
          return;
        }
        listRef.current?.scrollToIndex({
          index: target.index,
          animated: false,
          viewPosition: target.viewPosition,
        });
      });
    },
    [],
  );

  const renderCategory = useCallback(
    ({ item }: ListRenderItemInfo<DropdownCategory>) => (
      <CategoryRow
        item={item}
        active={item.category_id === activeCategoryId}
        accent={accent}
        onSelect={handleSelect}
      />
    ),
    [accent, activeCategoryId, handleSelect],
  );

  const keyExtractor = useCallback(
    (item: DropdownCategory) => String(item.category_id),
    [],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<DropdownCategory> | null | undefined, index: number) => ({
      length: CATEGORY_DROPDOWN_ROW_HEIGHT,
      offset: CATEGORY_DROPDOWN_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.root}>
      {/* header row */}
      <View ref={headerRef} style={styles.headerRow} collapsable={false}>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <AppIcon name="chevron-left" size={16} color={colors.fg} />
          </Pressable>
        )}
        <Pressable
          onPress={toggleOpen}
          style={[styles.trigger, open && styles.triggerOpen]}
          accessibilityRole="button"
          accessibilityLabel={`${label} category, ${
            activeCategoryName || 'none selected'
          }`}
          accessibilityState={{ expanded: open }}>
          <View
            style={[
              styles.triggerIcon,
              { backgroundColor: `${accent}26`, borderColor: `${accent}55` },
            ]}>
            <AppIcon name={icon} size={16} color={accent} />
          </View>
          <View style={styles.triggerBody}>
            <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
              {label}
            </Text>
            <View style={styles.triggerNameRow}>
              <Text style={styles.triggerName} numberOfLines={1}>
                {activeCategoryName || 'Select category'}
              </Text>
              <AppIcon
                name={open ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={colors.fgMuted}
                style={styles.chevron}
              />
            </View>
          </View>
        </Pressable>

        {onSearchToggle && (
          <Pressable
            onPress={onSearchToggle}
            style={[
              styles.searchBtn,
              searchActive
                ? { backgroundColor: `${accent}26`, borderColor: `${accent}66` }
                : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              searchActive ? 'Close content search' : 'Open content search'
            }
            accessibilityState={{ selected: searchActive }}>
            <AppIcon
              name="search"
              size={16}
              color={searchActive ? accent : colors.fgMuted}
            />
          </Pressable>
        )}
      </View>

      {/* overlay — rendered in a Modal so touches/scrolls on the panel
          don't fall through to the list behind it (Android drops touches
          on children that overflow their parent's bounds) */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeDropdown}>
        <Pressable
          style={styles.scrim}
          onPress={closeDropdown}
          accessible={false}
        />
        <View
          style={[styles.panel, { top: panelTop }]}
          accessibilityViewIsModal>
          <View style={[styles.panelSearch, { borderColor: `${accent}55` }]}>
            <AppIcon name="search" size={14} color={colors.fgSubtle} />
            <TextInput
              value={query}
              onChangeText={handleQueryChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.fgSubtle}
              style={styles.panelSearchInput}
              autoCorrect={false}
              autoCapitalize="none"
              selectionColor={accent}
              accessibilityLabel={searchPlaceholder}
            />
          </View>

          <FlatList
            ref={listRef}
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderCategory}
            getItemLayout={getItemLayout}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onLayout={restoreListPosition}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={styles.panelList}
            contentContainerStyle={styles.panelListContent}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No categories found</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    zIndex: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  trigger: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44,
  },
  triggerOpen: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
  },
  triggerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerBody: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.6,
  },
  triggerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  triggerName: {
    flexShrink: 1,
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '600',
    color: colors.fg,
  },
  chevron: {
    flexShrink: 0,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    flexShrink: 0,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    flexShrink: 0,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 2,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 6,
    maxHeight: 420,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  panelSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
    margin: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  panelSearchInput: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 15,
    color: colors.fg,
    padding: 0,
  },
  panelList: {
    maxHeight: 340,
  },
  panelListContent: {
    paddingBottom: 2,
  },
  row: {
    height: CATEGORY_DROPDOWN_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 12,
    minHeight: 48,
  },
  rowText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: colors.fgMuted,
  },
  rowTextActive: {
    color: colors.fg,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    color: colors.fgSubtle,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
