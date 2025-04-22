import React, {useEffect, useState, useCallback} from 'react';
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
import {useSelector, useDispatch} from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import {RootState, AppDispatch} from '../store';
import {
  fetchLiveChannels, // gets categories
  fetchLiveStreamsByCategory, // gets channels within a category
} from '../store/slices/iptvSlice';

const {width} = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 3; // 3‑column grid with 16px gutter

const LiveTVScreen = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();

  // credentials
  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user,
  );

  // IPTV slice state
  const {
    liveCategories,
    liveChannels,
    loadingCategories,
    loading,
    error,
  } = useSelector((state: RootState) => state.iptv);

  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');

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

  // once categories arrive or activeCategory changes, fetch streams
  useEffect(() => {
    if (liveCategories.length && (activeCategory ?? true)) {
      const categoryId = activeCategory || liveCategories[0]?.category_id;
      setActiveCategory(categoryId);
      dispatch(
        fetchLiveStreamsByCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId,
        }),
      );
    }
  }, [activeCategory, liveCategories, dispatch]);

  // ---------- render helpers ---------- //
  const renderCategoryPill = ({item}) => {
    const isActive = item.category_id === activeCategory;
    return (
      <TouchableOpacity
        style={[styles.categoryPill, isActive && styles.categoryPillActive]}
        onPress={() => setActiveCategory(item.category_id)}>
        <Text
          style={[styles.categoryText, isActive && styles.categoryTextActive]}>
          {item.category_name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderChannelCard = useCallback(
    ({item}) => {
      const icon = item.stream_icon || item.icon || null;
      const streamUrl = `http://${serverDomain}:${serverPort}/live/${username}/${password}/${item.stream_id}.m3u8`;

      return (
        <TouchableOpacity
          style={styles.channelCard}
          onPress={() =>
            navigation.navigate('VideoPlayer', {
              streamUrl,
              channelName: item.name,
              isLive: true
            })
          }>
          {icon ? (
            <Image source={{uri: icon}} style={styles.cardImage} />
          ) : (
            <View style={styles.cardPlaceholder}>
              <FontAwesome5 name="tv" size={28} color="#bbb" />
            </View>
          )}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [navigation, serverDomain, serverPort, username, password],
  );

  // filter channels by search
  const filteredChannels = liveChannels.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ---------- render ---------- //
  if (loadingCategories) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error: {error}</Text>
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
            <FontAwesome5 name="search" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <FontAwesome5 name="user" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <FontAwesome5
          name="search"
          size={14}
          color="#777"
          style={styles.searchIcon}
        />
        <TextInput
          placeholder="Search channels"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#999"
        />
      </View>
      <View style={styles.contentContainer}>
        {/* Category pills */}
        <FlatList
          data={liveCategories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.category_id.toString()}
          renderItem={renderCategoryPill}
          contentContainerStyle={styles.categoryList}
        />

        {/* Channels */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredChannels}
            keyExtractor={item => item.stream_id.toString()}
            renderItem={renderChannelCard}
            numColumns={3}
            columnWrapperStyle={{justifyContent: 'space-between'}}
            contentContainerStyle={styles.grid}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default LiveTVScreen;

// ---------- styles ---------- //
const HEADER_HEIGHT = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#2D3B55',
    paddingTop: HEADER_HEIGHT + 8, // leave space for custom header
  },
  contentContainer: {
    backgroundColor: '#F3F4F6',
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: 'red',
  },
  // custom header
  header: {
    // position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    backgroundColor: '#2D3B55',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
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
  avatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4A90E2',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  // search bar
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  // category pills
  categoryList: {
    height: 40,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#eee',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#4A90E2',
  },
  categoryText: {
    fontSize: 12,
    color: '#555',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
