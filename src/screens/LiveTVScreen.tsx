import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  ImageBackground,
} from 'react-native';

const backgroundImage = require('../assets/background-image-mobile.png');
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';

import { RootState, AppDispatch } from '../store';
import {
  fetchLiveChannels,
  fetchLiveStreamsByCategory,
} from '../store/slices/iptvSlice';
import CategoryPickerModal from '../components/CategoryPickerModal';
import { proxyStreamUrl } from '../utils/proxy';
import { buildLiveStreamUrl } from '../utils/xtream';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 56) / 3; // 3-column grid with 16px gutter

// Memoized channel card for performance
const ChannelCard = React.memo(
  ({
    item,
    onPress,
    cardSize,
    useProxy,
  }: {
    item: any;
    onPress: () => void;
    cardSize: number;
    useProxy: boolean;
  }) => {
    const rawIcon = item.stream_icon || item.icon || null;
    const icon = rawIcon ? proxyStreamUrl(rawIcon, useProxy) : null;
    return (
      <TouchableOpacity
        style={[styles.channelCard, { width: cardSize }]}
        onPress={onPress}
        activeOpacity={0.7}>
        <View style={icon ? styles.cardGlowingBorder : styles.cardGlowingBorderPlaceholder}>
          {icon ? (
            <View style={styles.cardImageContainer}>
              <Image source={{ uri: icon }} style={styles.cardImage} />
            </View>
          ) : (
            <FontAwesome5 name="tv" size={32} color="#F97316" />
          )}
        </View>
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
  const { username, password, serverDomain, serverPort, useProxy } = useSelector(
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
  }, [categories, activeCategory, username, password, serverDomain, serverPort, useProxy, dispatch]);

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
          useProxy,
        }),
      );
    },
    [dispatch, username, password, serverDomain, serverPort, useProxy],
  );

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
          cardSize={CARD_SIZE}
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
    [navigation, serverDomain, serverPort, username, password, useProxy, activeCategory],
  );

  const filteredChannels = channels.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()),
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
                useProxy,
              }),
            )
          }>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
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
              <FontAwesome5 name="user" size={16} color="#4A90E2" />
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
              color="#A0ABC0"
              style={styles.chipIcon}
            />
            <Text style={styles.chipText} numberOfLines={1}>
              {activeCategoryName || 'Select Category'}
            </Text>
            <FontAwesome5 name="chevron-down" size={12} color="#A0ABC0" />
          </TouchableOpacity>

          {/* Search bar */}
          <View style={styles.searchWrapper}>
            <FontAwesome5
              name="search"
              size={14}
              color="#A0ABC0"
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search channels"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#A0ABC0"
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
              <FontAwesome5 name="satellite-dish" size={40} color="#A0ABC0" />
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

        <CategoryPickerModal
          visible={showCategoryModal}
          categories={categories}
          activeCategory={activeCategory}
          onSelect={handleCategorySelect}
          onClose={() => setShowCategoryModal(false)}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

export default LiveTVScreen;

// ---------- styles ---------- //
const HEADER_HEIGHT = 32;

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    paddingTop: HEADER_HEIGHT + 8,
  },
  contentContainer: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#E2E8F0',
    fontSize: 14,
    marginTop: 12,
  },
  error: {
    color: '#ff4d4f',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3A7BD5',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    color: '#A0ABC0',
    fontSize: 14,
    marginTop: 12,
  },
  // header
  header: {
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderWidth: 1,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  // toolbar (category chip + search)
  toolbarContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chipIcon: {
    marginRight: 8,
  },
  chipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  // search bar
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    padding: 0,
  },
  // grid
  grid: {
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 12,
  },
  channelCard: {
    width: CARD_SIZE,
    marginBottom: 20,
    alignItems: 'center',
  },
  cardGlowingBorder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#4A90E2',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardImageContainer: {
    width: CARD_SIZE - 20,
    height: CARD_SIZE - 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  cardGlowingBorderPlaceholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    backgroundColor: 'rgba(249, 115, 22, 0.05)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
  },
});
