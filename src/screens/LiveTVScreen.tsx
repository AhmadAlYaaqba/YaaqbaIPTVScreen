import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';

import { RootState, AppDispatch } from '../store';
import {
  fetchLiveChannels,
  fetchLiveStreamsByCategory,
} from '../store/slices/iptvSlice';
import CategoryPickerModal from '../components/CategoryPickerModal';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 56) / 3; // 3-column grid with 16px gutter

// Memoized channel card for performance
const ChannelCard = React.memo(
  ({
    item,
    onPress,
    cardSize,
  }: {
    item: any;
    onPress: () => void;
    cardSize: number;
  }) => {
    const rawIcon = item.stream_icon || item.icon || null;
    const icon = rawIcon
      ? `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(
        rawIcon,
      )}`
      : null;
    return (
      <TouchableOpacity
        style={[styles.channelCard, { width: cardSize }]}
        onPress={onPress}
        activeOpacity={0.7}>
        {icon ? (
          <Image
            source={{ uri: icon }}
            style={[styles.cardImage, { width: cardSize, height: cardSize }]}
          />
        ) : (
          <View
            style={[
              styles.cardPlaceholder,
              { width: cardSize, height: cardSize },
            ]}>
            <FontAwesome5 name="tv" size={28} color="#bbb" />
          </View>
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

  // credentials
  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );

  // IPTV slice state
  const { liveCategories, liveChannels, loadingCategories, loading, error } =
    useSelector((state: RootState) => state.iptv);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // initial fetch categories
  useEffect(() => {
    if (username && password && serverDomain && serverPort) {
      dispatch(
        fetchLiveChannels({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
        }),
      );
    }
  }, [dispatch, username, password, serverDomain, serverPort]);

  // once categories arrive, default to first category
  useEffect(() => {
    if (liveCategories.length && !activeCategory) {
      const first = liveCategories[0];
      setActiveCategory(first.category_id);
      setActiveCategoryName(first.category_name);
      dispatch(
        fetchLiveStreamsByCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId: first.category_id,
        }),
      );
    }
  }, [liveCategories]);

  // fetch streams when category changes (after initial)
  const handleCategorySelect = useCallback(
    (categoryId: string, categoryName: string) => {
      setActiveCategory(categoryId);
      setActiveCategoryName(categoryName);
      setShowCategoryModal(false);
      setSearch('');
      dispatch(
        fetchLiveStreamsByCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId,
        }),
      );
    },
    [dispatch, username, password, serverDomain, serverPort],
  );

  const renderChannelCard = useCallback(
    ({ item }: { item: any }) => {
      const rawIcon = item.stream_icon || item.icon || null;
      const icon = rawIcon
        ? `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(
          rawIcon,
        )}`
        : null;
      const originalStreamUrl = `http://${serverDomain}:${serverPort}/live/${username}/${password}/${item.stream_id}.m3u8`;
      const streamUrl = `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(originalStreamUrl)}`;

      return (
        <ChannelCard
          item={item}
          cardSize={CARD_SIZE}
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
    [navigation, serverDomain, serverPort, username, password],
  );

  // filter channels by search
  const filteredChannels = liveChannels.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  console.log("filteredChannels ===>", filteredChannels)

  // FlatList layout optimization for fixed-size cards
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_SIZE + 16 + 18, // card height + margin + text
      offset: (CARD_SIZE + 16 + 18) * Math.floor(index / 3),
      index,
    }),
    [],
  );

  // ---------- render ---------- //
  if (loadingCategories) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <FontAwesome5 name="exclamation-circle" size={40} color="#E53935" />
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() =>
            dispatch(
              fetchLiveChannels({
                username,
                password,
                domain: serverDomain,
                port: serverPort,
              }),
            )
          }>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => navigation.goBack()}>
          <FontAwesome5 name="arrow-left" size={18} color="#fff" />
          <Text style={styles.headerTitle}> Live TV</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconButton}>
            <FontAwesome5 name="user" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category selector chip + search */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={styles.toolbarContainer}>
        {/* Active category chip */}
        <TouchableOpacity
          style={styles.categoryChip}
          onPress={() => setShowCategoryModal(true)}
          activeOpacity={0.75}>
          <FontAwesome5
            name="layer-group"
            size={14}
            color="#4A90E2"
            style={styles.chipIcon}
          />
          <Text style={styles.chipText} numberOfLines={1}>
            {activeCategoryName || 'Select Category'}
          </Text>
          <FontAwesome5 name="chevron-down" size={12} color="#666" />
        </TouchableOpacity>

        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <FontAwesome5
            name="search"
            size={13}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search channels"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#999"
            clearButtonMode="while-editing"
          />
        </View>
      </Animated.View>

      <View style={styles.contentContainer}>
        {/* Channels grid */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : filteredChannels.length === 0 ? (
          <View style={styles.center}>
            <FontAwesome5 name="satellite-dish" size={40} color="#ccc" />
            <Text style={styles.emptyText}>No channels found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredChannels}
            keyExtractor={item => item.stream_id.toString()}
            renderItem={renderChannelCard}
            numColumns={3}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={12}
            windowSize={5}
            initialNumToRender={12}
          />
        )}
      </View>

      {/* Category picker modal */}
      <CategoryPickerModal
        visible={showCategoryModal}
        categories={liveCategories}
        activeCategory={activeCategory}
        onSelect={handleCategorySelect}
        onClose={() => setShowCategoryModal(false)}
      />
    </SafeAreaView>
  );
};

export default LiveTVScreen;

// ---------- styles ---------- //
const HEADER_HEIGHT = 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    backgroundColor: '#2D3B55',
    paddingTop: HEADER_HEIGHT + 8,
  },
  contentContainer: {
    backgroundColor: '#F3F4F6',
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
  error: {
    color: '#E53935',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
  // header
  header: {
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    backgroundColor: '#2D3B55',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  // toolbar (category chip + search)
  toolbarContainer: {
    backgroundColor: '#2D3B55',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chipIcon: {
    marginRight: 8,
  },
  chipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3B55',
    marginRight: 8,
  },
  // search bar
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  // grid
  grid: {
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  channelCard: {
    width: CARD_SIZE,
    marginBottom: 16,
    alignItems: 'center',
  },
  cardImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 10,
    resizeMode: 'cover',
    marginBottom: 6,
  },
  cardPlaceholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 12,
    color: '#2D3B55',
    textAlign: 'center',
  },
});
