import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useDeferredValue,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FastImage from 'react-native-fast-image';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector } from 'react-redux';

import { RootState } from '../store';
import {
  getXtreamErrorMessage,
  useXtreamCategories,
  useXtreamCategoryContent,
} from '../services/xtream/xtreamQueries';
import type {
  XtreamCategory,
  XtreamSeriesItem,
  XtreamSession,
} from '../services/xtream/xtreamService';
import { proxyStreamUrl } from '../utils/proxy';
import { colors, sectionAccents, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import CategoryDropdown from '../components/mirror/CategoryDropdown';
import {
  CatalogGridSkeleton,
  CatalogStatus,
} from '../components/catalog/CatalogStates';
import { useCatalogViewState } from '../hooks/useCatalogViewState';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getTenPointRating } from '../utils/rating';
import type { TabScreenProps } from '../navigation/types';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const ACCENT = sectionAccents.series;
const { width } = Dimensions.get('window');
const H_PAD = 20;
const GUTTER = 12;
const COLUMNS = 3;
const ITEM_WIDTH = (width - H_PAD * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;
const POSTER_HEIGHT = ITEM_WIDTH * 1.5; // 2:3 portrait
const EMPTY_CATEGORIES: XtreamCategory[] = [];
const EMPTY_SERIES: XtreamSeriesItem[] = [];
const seriesKeyExtractor = (item: XtreamSeriesItem) => String(item.series_id);

// ─────────────────────────────────────────────────────────────
// Series poster card — portrait 2:3, scrim title, rating badge
// ─────────────────────────────────────────────────────────────
const SeriesPoster = React.memo(
  ({
    seriesId,
    name,
    cover,
    yearValue,
    ratingValue,
    ratingFiveBased,
    onPressSeries,
    useProxy,
  }: {
    seriesId: string;
    name: string;
    cover?: string;
    yearValue?: string | number;
    ratingValue?: string | number;
    ratingFiveBased?: string | number;
    onPressSeries: (seriesId: string) => void;
    useProxy: boolean;
  }) => {
    const yearMatch = yearValue ? String(yearValue).match(/\d{4}/) : null;
    const raw = cover?.trim();
    const posterUri = raw ? proxyStreamUrl(raw, useProxy) : null;
    const rating = getTenPointRating(ratingValue, ratingFiveBased);
    const handlePress = useCallback(
      () => onPressSeries(seriesId),
      [onPressSeries, seriesId],
    );

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={styles.poster}>
          {posterUri ? (
            <FastImage
              style={StyleSheet.absoluteFill}
              source={{ uri: posterUri, priority: FastImage.priority.normal }}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <FontAwesome5 name="tv" size={26} color={colors.fgSubtle} />
            </View>
          )}

          {!!yearMatch?.[0] && (
            <View style={styles.yearBadge}>
              <Text style={styles.yearText}>{yearMatch[0]}</Text>
            </View>
          )}

          {rating != null && (
            <View style={styles.ratingBadge}>
              <FontAwesome5 name="star" size={9} color={colors.warning} solid />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(6,8,16,0.55)', 'rgba(6,8,16,0.92)']}
            style={styles.scrim}
            pointerEvents="none"
          >
            <Text style={styles.posterTitle} numberOfLines={3}>
              {name}
            </Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  },
);

const SeriesHomeScreen: React.FC<TabScreenProps<'Series'>> = ({ navigation }) => {
  const searchRef = useRef<TextInput>(null);

  const { playlistId, username, password, serverDomain, serverPort, useProxy } =
    useSelector((s: RootState) => s.user);
  const session = useMemo<XtreamSession | null>(
    () =>
      playlistId
        ? {
            playlistId,
            username,
            password,
            domain: serverDomain,
            port: serverPort,
            useProxy,
          }
        : null,
    [playlistId, username, password, serverDomain, serverPort, useProxy],
  );

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const categoriesQuery = useXtreamCategories(session, 'series');
  const seriesCategories = categoriesQuery.data ?? EMPTY_CATEGORIES;
  const {
    activeCategoryId: activeCategory,
    activeCategoryName,
    selectCategory,
    contentOffset,
    onScroll,
    listKey,
  } = useCatalogViewState({
    playlistId,
    mediaType: 'series',
    categories: seriesCategories,
    categoriesReady: categoriesQuery.isSuccess,
  });
  const seriesQuery = useXtreamCategoryContent(
    session,
    'series',
    activeCategory,
  );
  const seriesList = seriesQuery.data ?? EMPTY_SERIES;
  const loadingCategories = categoriesQuery.isPending;
  const loading = seriesQuery.isPending;
  const error = getXtreamErrorMessage(
    categoriesQuery.error ?? seriesQuery.error,
  );
  const { isOffline } = useNetworkStatus();
  const {
    isError: categoriesError,
    isRefetching: refreshingCategories,
    refetch: refetchCategories,
  } = categoriesQuery;
  const {
    isError: seriesError,
    isRefetching: refreshingSeries,
    refetch: refetchSeries,
  } = seriesQuery;

  const changeCategory = useCallback(
    (categoryId: string) => {
      selectCategory(categoryId);
      setSearch('');
    },
    [selectCategory],
  );

  const toggleSearch = useCallback(() => {
    setSearchOpen(open => {
      const next = !open;
      if (!next) {
        setSearch('');
      } else {
        setTimeout(() => searchRef.current?.focus(), 60);
      }
      return next;
    });
  }, []);

  const seriesItems = useMemo(
    () => (Array.isArray(seriesList) ? seriesList : []),
    [seriesList],
  );
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalizedSearch
        ? seriesItems.filter(s =>
            s.name?.toLowerCase().includes(normalizedSearch),
          )
        : seriesItems,
    [seriesItems, normalizedSearch],
  );

  const handleSeriesPress = useCallback(
    (seriesId: string) => {
      const item = seriesItems.find(series => series.series_id === seriesId);
      if (!item) {
        return;
      }
      navigation.navigate('SeriesDetail', {
        seriesId: item.series_id,
        seriesName: item.name,
        baseInfo: item,
      });
    },
    [navigation, seriesItems],
  );

  const renderItem = useCallback(
    ({ item }: { item: XtreamSeriesItem }) => (
      <SeriesPoster
        seriesId={item.series_id}
        name={item.name}
        cover={item.cover}
        yearValue={item.year || item.releaseDate || item.release_date}
        ratingValue={item.rating}
        ratingFiveBased={item.rating_5based}
        useProxy={useProxy}
        onPressSeries={handleSeriesPress}
      />
    ),
    [handleSeriesPress, useProxy],
  );

  const handleRefresh = useCallback(() => {
    refetchCategories();
    if (activeCategory) {
      refetchSeries();
    }
  }, [activeCategory, refetchCategories, refetchSeries]);

  const handleRetry = useCallback(() => {
    if (categoriesError || seriesCategories.length === 0) {
      refetchCategories();
    }
    if (activeCategory && (seriesError || seriesItems.length === 0)) {
      refetchSeries();
    }
  }, [
    activeCategory,
    categoriesError,
    refetchCategories,
    refetchSeries,
    seriesCategories,
    seriesError,
    seriesItems,
  ]);

  const handleListScroll = useCallback(
    (event: Parameters<typeof onScroll>[0]) => {
      if (!normalizedSearch) {
        onScroll(event);
      }
    },
    [normalizedSearch, onScroll],
  );

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <CategoryDropdown
        label="SERIES"
        accent={ACCENT}
        icon="tv"
        categories={seriesCategories as any}
        activeCategoryId={activeCategory}
        activeCategoryName={activeCategoryName}
        onSelect={changeCategory}
        onSearchToggle={toggleSearch}
        searchActive={searchOpen}
        searchPlaceholder="Search categories"
        onBack={() =>
          navigation.canGoBack()
            ? navigation.goBack()
            : navigation.navigate('Home')
        }
      />

      {searchOpen && (
        <View style={styles.searchBarWrap}>
          <View style={[styles.searchBar, { borderColor: `${ACCENT}55` }]}>
            <FontAwesome5 name="search" size={15} color={colors.fgSubtle} />
            <TextInput
              ref={searchRef}
              value={search}
              onChangeText={setSearch}
              placeholder="Search series by title"
              placeholderTextColor={colors.fgSubtle}
              style={styles.searchInput}
              autoCorrect={false}
              selectionColor={ACCENT}
            />
            {!!search && (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  searchRef.current?.focus();
                }}
                hitSlop={8}
              >
                <FontAwesome5 name="times" size={14} color={colors.fgMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {normalizedSearch
            ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}`
            : `${seriesItems.length} titles`}
        </Text>
      </View>
    </View>
  );

  // ---------- render ---------- //
  if (isOffline && seriesCategories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="offline"
            title="You’re offline"
            message="Reconnect to load series categories that are not cached yet."
            accent={ACCENT}
            onRetry={handleRetry}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (categoriesError && seriesCategories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="error"
            title="Couldn’t load series"
            message={error}
            accent={ACCENT}
            onRetry={handleRetry}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (loadingCategories && seriesCategories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.safe}>
          <CatalogGridSkeleton
            accent={ACCENT}
            itemWidth={ITEM_WIDTH}
            itemHeight={POSTER_HEIGHT}
            gutter={GUTTER}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (categoriesQuery.isSuccess && seriesCategories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="empty"
            title="No series categories"
            message="This playlist did not return any series categories."
            accent={ACCENT}
            onRetry={handleRetry}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AmbientGlow accent={ACCENT} />
      <SafeAreaView style={styles.safe}>
        {renderHeader()}
        {loading && seriesItems.length === 0 ? (
          <CatalogGridSkeleton
            accent={ACCENT}
            itemWidth={ITEM_WIDTH}
            itemHeight={POSTER_HEIGHT}
            gutter={GUTTER}
          />
        ) : seriesItems.length === 0 && (isOffline || seriesError) ? (
          <CatalogStatus
            kind={isOffline ? 'offline' : 'error'}
            title={isOffline ? 'You’re offline' : 'Couldn’t load series'}
            message={
              isOffline
                ? 'Reconnect or choose a category that is already cached.'
                : error
            }
            accent={ACCENT}
            onRetry={handleRetry}
          />
        ) : (
          <FlatList
            key={listKey}
            style={styles.grid}
            data={filtered}
            keyExtractor={seriesKeyExtractor}
            renderItem={renderItem}
            numColumns={COLUMNS}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentOffset={contentOffset}
            onScroll={handleListScroll}
            scrollEventThrottle={200}
            refreshControl={
              <RefreshControl
                refreshing={refreshingCategories || refreshingSeries}
                onRefresh={handleRefresh}
                tintColor={ACCENT}
                colors={[ACCENT]}
              />
            }
            removeClippedSubviews
            maxToRenderPerBatch={12}
            windowSize={5}
            initialNumToRender={12}
            ListEmptyComponent={
              <CatalogStatus
                kind="empty"
                title={
                  normalizedSearch ? 'No matching series' : 'No series found'
                }
                message={
                  normalizedSearch
                    ? 'Try a different search term.'
                    : 'This category is currently empty.'
                }
                accent={ACCENT}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default SeriesHomeScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  headerBlock: {
    zIndex: 20,
    elevation: 20,
  },
  centerSafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  loadingText: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    fontFamily: FONT,
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyText: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 14,
    marginTop: 12,
  },

  // search bar
  searchBarWrap: {
    paddingHorizontal: H_PAD,
    paddingTop: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 15,
    color: colors.fg,
    padding: 0,
  },

  // meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 4,
  },
  metaText: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.fgSubtle,
  },

  // grid
  grid: {
    flex: 1,
    zIndex: 1,
  },
  gridContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    paddingBottom: 120,
  },
  columnWrapper: {
    gap: GUTTER,
    marginBottom: GUTTER + 2,
  },
  card: {
    alignItems: 'stretch',
    width: ITEM_WIDTH,
  },
  poster: {
    width: '100%',
    height: POSTER_HEIGHT,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posterPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  yearBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(8,11,22,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  yearText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '600',
    color: colors.fg,
  },
  ratingBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(8,11,22,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  ratingText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '600',
    color: colors.fg,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingTop: 30,
    paddingBottom: 10,
    minHeight: 64,
  },
  posterTitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: colors.fg,
    lineHeight: 16,
  },
});
