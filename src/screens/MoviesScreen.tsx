import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  TextInput,
  Dimensions,
  SafeAreaView,
  ImageBackground,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';

import { RootState, AppDispatch } from '../store';
import {
  fetchMovieCategories,
  fetchMoviesInCategory,
} from '../store/slices/iptvSlice';
import CategoryPickerModal from '../components/CategoryPickerModal';

const backgroundImage = require('../assets/background-image-mobile.png');

const { width } = Dimensions.get('window');
// 3-column grid with 12px horizontal padding total (6 each side), margins of 8px per card
const CARD_WIDTH = (width - 24 - 16 * 3) / 3;
const CARD_HEIGHT = CARD_WIDTH * 1.5; // 2:3 aspect ratio portrait

// Memoized movie card for performance
const MovieCard = React.memo(
  ({
    item,
    onPress,
  }: {
    item: any;
    onPress: () => void;
  }) => {
    const rawIcon = item.stream_icon || item.icon || null;
    return (
      <TouchableOpacity
        style={styles.movieCard}
        onPress={onPress}
        activeOpacity={0.7}>
        <View style={rawIcon ? styles.cardGlowingBorder : styles.cardGlowingBorderPlaceholder}>
          {rawIcon ? (
            <View style={styles.cardImageContainer}>
              <FastImage
                source={{
                  uri: rawIcon,
                  priority: FastImage.priority.normal,
                }}
                style={styles.cardImage}
                resizeMode={FastImage.resizeMode.cover}
              />
            </View>
          ) : (
            <FontAwesome5 name="film" size={32} color="#F97316" />
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  },
);

const MoviesScreen: React.FC<any> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();

  // credentials
  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );

  // IPTV slice state
  const { movieCategories, movieList, loading, error } =
    useSelector((state: RootState) => state.iptv);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // initial fetch categories
  useEffect(() => {
    if (username && password && serverDomain && serverPort) {
      dispatch(
        fetchMovieCategories({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
        }),
      );
    }
  }, [dispatch, username, password, serverDomain, serverPort]);

  const safeMovieCategories = Array.isArray(movieCategories) ? movieCategories : [];

  useEffect(() => {
    if (safeMovieCategories.length && !activeCategory) {
      const first = safeMovieCategories[0];
      setActiveCategory(first.category_id);
      setActiveCategoryName(first.category_name);
      dispatch(
        fetchMoviesInCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId: first.category_id,
        }),
      );
    }
  }, [safeMovieCategories]);

  // fetch movies when category changes (after initial)
  const handleCategorySelect = useCallback(
    (categoryId: string, categoryName: string) => {
      setActiveCategory(categoryId);
      setActiveCategoryName(categoryName);
      setShowCategoryModal(false);
      setSearch('');
      dispatch(
        fetchMoviesInCategory({
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

  const renderMovieCard = useCallback(
    ({ item }: { item: any }) => {
      return (
        <MovieCard
          item={item}
          onPress={() =>
            navigation.navigate('MovieDetail', {
              movie: item,
            })
          }
        />
      );
    },
    [navigation],
  );

  const movies = Array.isArray(movieList) ? movieList : [];
  const filteredMovies = movies.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()),
  );

  // FlatList layout optimization for fixed-size cards
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_HEIGHT + 24 + 20, // card height + margins + text
      offset: (CARD_HEIGHT + 24 + 20) * Math.floor(index / 3),
      index,
    }),
    [],
  );

  // ---------- render ---------- //
  if (!safeMovieCategories.length && loading) {
    return (
      <ImageBackground source={backgroundImage} style={styles.backgroundImage}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      </ImageBackground>
    );
  }

  if (error && !safeMovieCategories.length) {
    return (
      <ImageBackground source={backgroundImage} style={styles.backgroundImage}>
        <View style={styles.center}>
          <FontAwesome5 name="exclamation-circle" size={40} color="#ff4d4f" />
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              dispatch(
                fetchMovieCategories({
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
      </ImageBackground>
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
            <Text style={styles.headerTitle}> Movies</Text>
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
              placeholder="Search movies"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#A0ABC0"
              clearButtonMode="while-editing"
            />
          </View>
        </Animated.View>

        <View style={styles.contentContainer}>
          {/* Movies grid */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#4A90E2" />
            </View>
          ) : filteredMovies.length === 0 ? (
            <View style={styles.center}>
              <FontAwesome5 name="film" size={40} color="#A0ABC0" />
              <Text style={styles.emptyText}>No movies found</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMovies}
              keyExtractor={item => item.stream_id?.toString() || item.name}
              renderItem={renderMovieCard}
              numColumns={3}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={12}
              windowSize={5}
              initialNumToRender={12}
              getItemLayout={getItemLayout}
            />
          )}
        </View>

        <CategoryPickerModal
          visible={showCategoryModal}
          categories={safeMovieCategories}
          activeCategory={activeCategory}
          onSelect={handleCategorySelect}
          onClose={() => setShowCategoryModal(false)}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

export default MoviesScreen;

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
  movieCard: {
    width: CARD_WIDTH,
    marginBottom: 20,
    alignItems: 'center',
  },
  cardGlowingBorder: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
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
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Add borders
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGlowingBorderPlaceholder: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
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

