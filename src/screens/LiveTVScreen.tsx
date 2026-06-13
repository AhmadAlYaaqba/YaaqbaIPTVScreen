import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import { RootState, AppDispatch } from '../store';
import {
  fetchLiveChannels,
  fetchLiveStreamsByCategory,
} from '../store/slices/iptvSlice';
import { proxyStreamUrl } from '../utils/proxy';
import { buildLiveStreamUrl } from '../utils/xtream';
import { colors, sectionAccents, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import CategoryDropdown from '../components/mirror/CategoryDropdown';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const ACCENT = sectionAccents.live;
const { width } = Dimensions.get('window');
const H_PAD = 20;
const GUTTER = 10;
const COLUMNS = 3;
const ITEM_WIDTH = (width - H_PAD * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;

// ─────────────────────────────────────────────────────────────
// Channel grid card — logo (or dashed fallback) + number + name
// ─────────────────────────────────────────────────────────────
const ChannelCard = React.memo(
  ({
    item,
    onPress,
    useProxy,
  }: {
    item: any;
    onPress: () => void;
    useProxy: boolean;
  }) => {
    const rawIcon = item.stream_icon || item.icon || null;
    const icon = rawIcon ? proxyStreamUrl(rawIcon, useProxy) : null;
    const number = item.num != null ? String(item.num) : '';

    return (
      <TouchableOpacity
        style={[styles.card, { width: ITEM_WIDTH }]}
        onPress={onPress}
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
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  },
);

const LiveTVScreen: React.FC<any> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();

  const { username, password, serverDomain, serverPort, useProxy } =
    useSelector((state: RootState) => state.user);

  const { liveCategories, liveChannels, loadingCategories, loading, error } =
    useSelector((state: RootState) => state.iptv);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<TextInput>(null);

  // initial fetch categories
  useEffect(() => {
    if (username && password && serverDomain && serverPort) {
      dispatch(
        fetchLiveChannels({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          useProxy,
        }),
      );
    }
  }, [dispatch, username, password, serverDomain, serverPort, useProxy]);

  const categories = useMemo(
    () => (Array.isArray(liveCategories) ? liveCategories : []),
    [liveCategories],
  );
  const channels = useMemo(
    () => (Array.isArray(liveChannels) ? liveChannels : []),
    [liveChannels],
  );

  // open on first category's channels
  useEffect(() => {
    if (categories.length && !activeCategory) {
      const first = categories[0];
      setActiveCategory(first.category_id);
      setActiveCategoryName(first.category_name);
      dispatch(
        fetchLiveStreamsByCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId: first.category_id,
          useProxy,
        }),
      );
    }
  }, [
    categories,
    activeCategory,
    username,
    password,
    serverDomain,
    serverPort,
    useProxy,
    dispatch,
  ]);

  const handleCategorySelect = useCallback(
    (categoryId: string, categoryName: string) => {
      setActiveCategory(categoryId);
      setActiveCategoryName(categoryName);
      setSearch('');
      dispatch(
        fetchLiveStreamsByCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId,
          useProxy,
        }),
      );
    },
    [dispatch, username, password, serverDomain, serverPort, useProxy],
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

  const renderChannelCard = useCallback(
    ({ item }: { item: any }) => {
      const rawIcon = item.stream_icon || item.icon || null;
      const icon = rawIcon ? proxyStreamUrl(rawIcon, useProxy) : null;
      const originalStreamUrl = buildLiveStreamUrl({
        domain: serverDomain,
        port: serverPort,
        username,
        password,
        streamId: item.stream_id,
      });
      const streamUrl = proxyStreamUrl(originalStreamUrl, useProxy);

      return (
        <ChannelCard
          item={item}
          useProxy={useProxy}
          onPress={() =>
            navigation.navigate('VideoPlayer', {
              streamUrl,
              channelName: item.name,
              isLive: true,
              thumbnail: icon,
              categoryId: activeCategory || undefined,
            })
          }
        />
      );
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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredChannels = useMemo(
    () =>
      normalizedSearch
        ? channels.filter(c =>
            c.name?.toLowerCase().includes(normalizedSearch),
          )
        : channels,
    [channels, normalizedSearch],
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
  if (loadingCategories) {
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
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: `${ACCENT}66` }]}
            activeOpacity={0.8}
            onPress={() =>
              dispatch(
                fetchLiveChannels({
                  username,
                  password,
                  domain: serverDomain,
                  port: serverPort,
                  useProxy,
                }),
              )
            }
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
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
            data={filteredChannels}
            keyExtractor={item => String(item.stream_id)}
            renderItem={renderChannelCard}
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
                <FontAwesome5
                  name="satellite-dish"
                  size={36}
                  color={colors.fgSubtle}
                />
                <Text style={styles.emptyText}>No channels found</Text>
              </View>
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
