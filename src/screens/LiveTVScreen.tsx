import React, {
  useState,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import { RootState } from '../store';
import {
  getXtreamErrorMessage,
  useXtreamCategories,
  useXtreamCategoryContent,
} from '../services/xtream/xtreamQueries';
import type {
  XtreamCategory,
  XtreamLiveStream,
  XtreamSession,
} from '../services/xtream/xtreamService';
import { proxyStreamUrl } from '../utils/proxy';
import { buildLiveStreamUrl } from '../utils/xtream';
import { colors, sectionAccents, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import CategoryDropdown from '../components/mirror/CategoryDropdown';
import {
  CatalogGridSkeleton,
  CatalogStatus,
} from '../components/catalog/CatalogStates';
import { useCatalogViewState } from '../hooks/useCatalogViewState';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import type { TabScreenProps } from '../navigation/types';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const ACCENT = sectionAccents.live;
const { width } = Dimensions.get('window');
const H_PAD = 20;
const GUTTER = 10;
const COLUMNS = 3;
const ITEM_WIDTH = (width - H_PAD * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;
const EMPTY_CATEGORIES: XtreamCategory[] = [];
const EMPTY_CHANNELS: XtreamLiveStream[] = [];
const channelKeyExtractor = (item: XtreamLiveStream) => String(item.stream_id);

// ─────────────────────────────────────────────────────────────
// Channel grid card — logo (or dashed fallback) + number + name
// ─────────────────────────────────────────────────────────────
const ChannelCard = React.memo(
  ({
    streamId,
    name,
    rawIcon,
    channelNumber,
    onPressChannel,
    useProxy,
  }: {
    streamId: number;
    name: string;
    rawIcon?: string;
    channelNumber?: number;
    onPressChannel: (
      streamId: number,
      name: string,
      rawIcon?: string,
    ) => void;
    useProxy: boolean;
  }) => {
    const icon = rawIcon ? proxyStreamUrl(rawIcon, useProxy) : null;
    const number = channelNumber != null ? String(channelNumber) : '';
    const handlePress = useCallback(
      () => onPressChannel(streamId, name, rawIcon),
      [name, onPressChannel, rawIcon, streamId],
    );

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.logoTile}>
          {icon ? (
            <Image
              source={{ uri: icon }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoFallback}>
              <FontAwesome5 name="tv" size={26} color={colors.fgSubtle} />
            </View>
          )}
        </View>
        {!!number && (
          <Text style={styles.cardNumber} numberOfLines={1}>
            {number}
          </Text>
        )}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {name}
        </Text>
      </TouchableOpacity>
    );
  },
);

const LiveTVScreen: React.FC<TabScreenProps<'LiveTV'>> = ({ navigation }) => {
  const { playlistId, username, password, serverDomain, serverPort, useProxy } =
    useSelector((state: RootState) => state.user);
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
  const searchRef = useRef<TextInput>(null);

  const categoriesQuery = useXtreamCategories(session, 'live');
  const categories = categoriesQuery.data ?? EMPTY_CATEGORIES;
  const {
    activeCategoryId: activeCategory,
    activeCategoryName,
    selectCategory,
    contentOffset,
    onScroll,
    listKey,
  } = useCatalogViewState({
    playlistId,
    mediaType: 'live',
    categories,
    categoriesReady: categoriesQuery.isSuccess,
  });
  const channelsQuery = useXtreamCategoryContent(
    session,
    'live',
    activeCategory,
  );
  const channels = channelsQuery.data ?? EMPTY_CHANNELS;
  const loadingCategories = categoriesQuery.isPending;
  const loading = channelsQuery.isPending;
  const error = getXtreamErrorMessage(
    categoriesQuery.error ?? channelsQuery.error,
  );
  const { isOffline } = useNetworkStatus();
  const {
    isError: categoriesError,
    isRefetching: refreshingCategories,
    refetch: refetchCategories,
  } = categoriesQuery;
  const {
    isError: channelsError,
    isRefetching: refreshingChannels,
    refetch: refetchChannels,
  } = channelsQuery;

  const handleCategorySelect = useCallback(
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

  const handleChannelPress = useCallback(
    (streamId: number, name: string, rawIcon?: string) => {
      const icon = rawIcon ? proxyStreamUrl(rawIcon, useProxy) : null;
      const originalStreamUrl = buildLiveStreamUrl({
        domain: serverDomain,
        port: serverPort,
        username,
        password,
        streamId,
      });
      const streamUrl = proxyStreamUrl(originalStreamUrl, useProxy);

      navigation.navigate('VideoPlayer', {
        streamUrl,
        streamId: String(streamId),
        containerExtension: 'm3u8',
        channelName: name,
        isLive: true,
        thumbnail: icon ?? undefined,
        categoryId: activeCategory ?? undefined,
      });
    },
    [
      navigation,
      serverDomain,
      serverPort,
      username,
      password,
      useProxy,
      activeCategory,
    ],
  );

  const renderChannelCard = useCallback(
    ({ item }: { item: XtreamLiveStream }) => (
      <ChannelCard
        streamId={item.stream_id}
        name={item.name}
        rawIcon={item.stream_icon || item.icon}
        channelNumber={item.num}
        useProxy={useProxy}
        onPressChannel={handleChannelPress}
      />
    ),
    [handleChannelPress, useProxy],
  );

  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredChannels = useMemo(
    () =>
      normalizedSearch
        ? channels.filter(c =>
            c.name?.toLowerCase().includes(normalizedSearch),
          )
        : channels,
    [channels, normalizedSearch],
  );

  const handleRefresh = useCallback(() => {
    refetchCategories();
    if (activeCategory) {
      refetchChannels();
    }
  }, [activeCategory, refetchCategories, refetchChannels]);

  const handleRetry = useCallback(() => {
    if (categoriesError || categories.length === 0) {
      refetchCategories();
    }
    if (activeCategory && (channelsError || channels.length === 0)) {
      refetchChannels();
    }
  }, [
    activeCategory,
    categories,
    categoriesError,
    channels,
    channelsError,
    refetchCategories,
    refetchChannels,
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
        label="LIVE TV"
        accent={ACCENT}
        icon="satellite-dish"
        categories={categories}
        activeCategoryId={activeCategory}
        activeCategoryName={activeCategoryName}
        onSelect={handleCategorySelect}
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
              placeholder={`Search ${activeCategoryName || 'channels'}`}
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
            ? `${filteredChannels.length} result${
                filteredChannels.length === 1 ? '' : 's'
              }`
            : `${channels.length} channels`}
        </Text>
      </View>
    </View>
  );

  // ---------- render ---------- //
  if (isOffline && categories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="offline"
            title="You’re offline"
            message="Reconnect to load Live TV categories that are not cached yet."
            accent={ACCENT}
            onRetry={handleRetry}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (categoriesError && categories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="error"
            title="Couldn’t load Live TV"
            message={error}
            accent={ACCENT}
            onRetry={handleRetry}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (loadingCategories && categories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.safe}>
          <CatalogGridSkeleton
            accent={ACCENT}
            itemWidth={ITEM_WIDTH}
            itemHeight={ITEM_WIDTH + 34}
            gutter={GUTTER}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (categoriesQuery.isSuccess && categories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="empty"
            title="No Live TV categories"
            message="This playlist did not return any live categories."
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
        {loading && channels.length === 0 ? (
          <CatalogGridSkeleton
            accent={ACCENT}
            itemWidth={ITEM_WIDTH}
            itemHeight={ITEM_WIDTH + 34}
            gutter={GUTTER}
          />
        ) : channels.length === 0 && (isOffline || channelsError) ? (
          <CatalogStatus
            kind={isOffline ? 'offline' : 'error'}
            title={isOffline ? 'You’re offline' : 'Couldn’t load channels'}
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
            data={filteredChannels}
            keyExtractor={channelKeyExtractor}
            renderItem={renderChannelCard}
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
                refreshing={refreshingCategories || refreshingChannels}
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
                  normalizedSearch ? 'No matching channels' : 'No channels found'
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

export default LiveTVScreen;

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
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: colors.glass,
  },
  retryText: {
    fontFamily: FONT,
    color: colors.fg,
    fontWeight: '600',
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
    paddingTop: 8,
    paddingBottom: 120,
  },
  columnWrapper: {
    gap: GUTTER,
    marginBottom: GUTTER,
  },
  card: {
    width: ITEM_WIDTH,
    alignItems: 'stretch',
  },
  logoTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '78%',
    height: '78%',
  },
  logoFallback: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardNumber: {
    fontFamily: MONO,
    fontSize: 10,
    color: colors.fgSubtle,
    marginTop: 8,
  },
  cardTitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: colors.fg,
    marginTop: 2,
  },
});
