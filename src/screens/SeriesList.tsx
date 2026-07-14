/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FastImage from 'react-native-fast-image';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';

import { RootState, AppDispatch } from '../store';
import { fetchSeries, fetchSeriesByCategory } from '../store/slices/iptvSlice';
import { proxyStreamUrl } from '../utils/proxy';
import { colors, sectionAccents, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import CategoryDropdown from '../components/mirror/CategoryDropdown';
import { useTmdbMatch } from '../hooks/useTmdbMatch';
import { getTenPointRating } from '../utils/rating';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const ACCENT = sectionAccents.series;
const { width } = Dimensions.get('window');
const H_PAD = 20;
const GUTTER = 12;
const COLUMNS = 3;
const ITEM_WIDTH = (width - H_PAD * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;
const POSTER_HEIGHT = ITEM_WIDTH * 1.5; // 2:3 portrait

// ─────────────────────────────────────────────────────────────
// Series poster card — portrait 2:3, scrim title, rating badge
// ─────────────────────────────────────────────────────────────
const SeriesPoster = React.memo(
  ({
    item,
    onPress,
    useProxy,
  }: {
    item: any;
    onPress: () => void;
    useProxy: boolean;
  }) => {
    const yearSrc = item.year || item.releaseDate || item.release_date;
    const yearMatch = yearSrc ? String(yearSrc).match(/\d{4}/) : null;
    const xtreamYear = yearMatch ? parseInt(yearMatch[0], 10) : undefined;

    const raw = item.cover?.trim();
    const xtreamUri = raw ? proxyStreamUrl(raw, useProxy) : null;

    // Only hit TMDB for items that lack Xtream artwork — avoids flooding
    // TMDB with one search per visible row when the provider already has art.
    const { media: tmdbMedia } = useTmdbMatch({
      title: item.name,
      year: xtreamYear,
      type: 'series',
      enabled: !xtreamUri,
    });

    const posterUri = xtreamUri || tmdbMedia?.poster || null;

    const rating =
      getTenPointRating(item.rating, item.rating_5based) ??
      tmdbMedia?.rating ??
      null;

    const year =
      yearMatch?.[0] ||
      (tmdbMedia?.releaseDate
        ? tmdbMedia.releaseDate.substring(0, 4)
        : null);

    return (
      <TouchableOpacity
        style={[styles.card, { width: ITEM_WIDTH }]}
        onPress={onPress}
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

          {!!year && (
            <View style={styles.yearBadge}>
              <Text style={styles.yearText}>{year}</Text>
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
              {item.name}
            </Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  },
);

const SeriesHomeScreen: React.FC<any> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const searchRef = useRef<TextInput>(null);

  const { username, password, serverDomain, serverPort, useProxy } =
    useSelector((s: RootState) => s.user);
  const {
    seriesCategories,
    seriesList,
    loadingCategories,
    loading,
    error,
  } = useSelector((s: RootState) => s.iptv);

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');

  // fetch categories once
  useEffect(() => {
    dispatch(
      fetchSeries({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        useProxy,
      }),
    );
  }, [dispatch, username, password, serverDomain, serverPort, useProxy]);

  // open first category once categories arrive
  useEffect(() => {
    if (!loadingCategories && seriesCategories.length && !activeCategory) {
      const first = seriesCategories[0];
      changeCategory(first.category_id, first.category_name);
    }
  }, [loadingCategories, seriesCategories]);

  const changeCategory = useCallback(
    (categoryId: string, categoryName: string) => {
      if (categoryId === activeCategory) return;
      setActiveCategory(categoryId);
      setActiveCategoryName(categoryName);
      setSearch('');
      dispatch(
        fetchSeriesByCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId,
          useProxy,
        }),
      );
    },
    [dispatch, username, password, serverDomain, serverPort, activeCategory, useProxy],
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
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalizedSearch
        ? seriesItems.filter(s =>
            s.name?.toLowerCase().includes(normalizedSearch),
          )
        : seriesItems,
    [seriesItems, normalizedSearch],
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <SeriesPoster
        item={item}
        useProxy={useProxy}
        onPress={() =>
          navigation.navigate('SeriesDetail', {
            seriesId: item.series_id,
            seriesName: item.name,
            baseInfo: item,
          })
        }
      />
    ),
    [navigation, useProxy],
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
  if (loadingCategories || !activeCategory) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading categories…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <FontAwesome5
            name="exclamation-circle"
            size={36}
            color={colors.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AmbientGlow accent={ACCENT} />
      <SafeAreaView style={styles.safe}>
        {renderHeader()}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <FlatList
            style={styles.grid}
            data={filtered}
            keyExtractor={i => String(i.series_id)}
            renderItem={renderItem}
            numColumns={COLUMNS}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            maxToRenderPerBatch={12}
            windowSize={5}
            initialNumToRender={12}
            ListEmptyComponent={
              <View style={styles.center}>
                <FontAwesome5 name="tv" size={36} color={colors.fgSubtle} />
                <Text style={styles.emptyText}>No series found</Text>
              </View>
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
