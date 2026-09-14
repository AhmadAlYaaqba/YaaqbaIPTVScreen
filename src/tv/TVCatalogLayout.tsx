// src/tv/TVCatalogLayout.tsx
// Two-pane catalog layout for TV: a persistent category column on the left and
// the screen's own content (header + grid) on the right.
//
// - Phones: renders `children` unchanged, so the existing dropdown layout is
//   untouched.
// - Select (not focus) changes category: moving focus through a long category
//   list must not refetch or remount the grid on every step.
// - TVFocusGuideView autoFocus remembers the last focused row, so pressing
//   Left from the grid returns to the category the user last picked.
// - Fixed row height + getItemLayout keep the list windowed and let it open
//   scrolled to the active category.

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import FocusablePressable from './FocusablePressable';
import TVTextInput from './TVTextInput';
import { colors, radii, space } from '../theme/colors';

const IS_TV = Platform.isTV;

/** Category column width in dp; screens subtract it when sizing grids on TV. */
export const TV_CATEGORY_PANE_WIDTH = 240;
const ROW_HEIGHT = 52;

export interface TVCatalogCategory {
  category_id: string;
  category_name: string;
}

export interface TVCatalogLayoutProps {
  label: string;
  accent: string;
  categories: TVCatalogCategory[];
  activeCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  children: React.ReactNode;
}

const CategoryRow = memo(function CategoryRow({
  item,
  active,
  accent,
  onSelect,
  rowRef,
}: {
  item: TVCatalogCategory;
  active: boolean;
  accent: string;
  onSelect: (categoryId: string) => void;
  rowRef?: React.Ref<View>;
}) {
  const handlePress = useCallback(
    () => onSelect(item.category_id),
    [item.category_id, onSelect],
  );
  return (
    <FocusablePressable
      ref={rowRef}
      onPress={handlePress}
      focusScale={1}
      style={[styles.row, active && { backgroundColor: `${accent}24` }]}
      accessibilityRole="button"
      accessibilityLabel={item.category_name}
      accessibilityState={{ selected: active }}>
      <View style={[styles.activeBar, active && { backgroundColor: accent }]} />
      <Text
        style={[styles.rowText, active && styles.rowTextActive]}
        numberOfLines={1}>
        {item.category_name}
      </Text>
    </FocusablePressable>
  );
});

const keyExtractor = (item: TVCatalogCategory) => item.category_id;
const getItemLayout = (_data: unknown, index: number) => ({
  length: ROW_HEIGHT,
  offset: ROW_HEIGHT * index,
  index,
});

function TVCatalogLayout({
  label,
  accent,
  categories,
  activeCategoryId,
  onSelectCategory,
  children,
}: TVCatalogLayoutProps) {
  const [filter, setFilter] = useState('');
  // Entering the column lands on the active category while its row is
  // mounted. An empty list clears the destination: a destination that is not
  // in the tree (virtualized away) would block focus from entering at all, so
  // autoFocus takes over instead.
  const [activeRowNode, setActiveRowNode] = useState<View | null>(null);
  const focusDestinations = useMemo(
    () => (activeRowNode ? [activeRowNode] : []),
    [activeRowNode],
  );
  const normalizedFilter = filter.trim().toLowerCase();

  const visibleCategories = useMemo(
    () =>
      normalizedFilter
        ? categories.filter(c =>
            c.category_name?.toLowerCase().includes(normalizedFilter),
          )
        : categories,
    [categories, normalizedFilter],
  );

  const activeIndex = useMemo(
    () =>
      normalizedFilter
        ? -1
        : categories.findIndex(c => c.category_id === activeCategoryId),
    [activeCategoryId, categories, normalizedFilter],
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<TVCatalogCategory>) => (
      <CategoryRow
        item={item}
        active={item.category_id === activeCategoryId}
        accent={accent}
        onSelect={onSelectCategory}
        rowRef={
          item.category_id === activeCategoryId ? setActiveRowNode : undefined
        }
      />
    ),
    [accent, activeCategoryId, onSelectCategory],
  );

  if (!IS_TV) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.pane}>
        <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.count}>
          {normalizedFilter
            ? `${visibleCategories.length} of ${categories.length} categories`
            : `${categories.length} categories`}
        </Text>
        <TVTextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter categories"
          placeholderTextColor={colors.fgSubtle}
          style={styles.filter}
          autoCorrect={false}
          selectionColor={accent}
          accessibilityLabel="Filter categories"
        />
        {/* The focus guide wraps only the rows, so entering the column from the
            grid lands on a category rather than on the filter input. */}
        <TVFocusGuideView
          autoFocus
          destinations={focusDestinations}
          style={styles.list}>
          <FlatList
            // Remount when filtering starts/stops so initialScrollIndex applies.
            key={normalizedFilter ? 'filtered' : 'all'}
            data={visibleCategories}
            keyExtractor={keyExtractor}
            renderItem={renderRow}
            getItemLayout={getItemLayout}
            initialScrollIndex={activeIndex > 0 ? activeIndex : undefined}
            initialNumToRender={14}
            maxToRenderPerBatch={14}
            windowSize={5}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        </TVFocusGuideView>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  pane: {
    width: TV_CATEGORY_PANE_WIDTH,
    paddingTop: space.s5,
    paddingHorizontal: space.s3,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: 'rgba(11,16,32,0.72)',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    paddingHorizontal: space.s2,
  },
  count: {
    color: colors.fgSubtle,
    fontSize: 12,
    marginTop: 2,
    marginBottom: space.s3,
    paddingHorizontal: space.s2,
  },
  filter: {
    height: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.glass,
    color: colors.fg,
    fontSize: 14,
    paddingHorizontal: space.s3,
    marginBottom: space.s2,
  },
  list: {
    flex: 1,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    paddingRight: space.s3,
  },
  activeBar: {
    width: 3,
    height: 22,
    borderRadius: 2,
    marginLeft: space.s1,
    marginRight: space.s3,
    backgroundColor: 'transparent',
  },
  rowText: {
    flex: 1,
    color: colors.fgMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  rowTextActive: {
    color: colors.fg,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});

export default TVCatalogLayout;
