/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
  SafeAreaView,
  ImageBackground,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Swiper from 'react-native-swiper';
import Animated, { FadeInDown } from 'react-native-reanimated';

const backgroundImage = require('../assets/background-image-mobile.png');

import { RootState, AppDispatch } from '../store';
import {
  fetchMovieCategories,
  fetchMoviesInCategory,
} from '../store/slices/iptvSlice';
import { storage } from '../utils/storage';
import { proxyStreamUrl } from '../utils/proxy';
import CategoryPickerModal from '../components/CategoryPickerModal';
import { buildMovieStreamUrl } from '../utils/xtream';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 56) / 3;
const CARD_HEIGHT = CARD_SIZE * 1.5; // 2:3 aspect ratio

/* ─────────────────────────────────────────────── Component */
const MoviesScreen: React.FC<any> = ({ navigation }) => {
  /* ─── Hooks / Redux */
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const searchRef = useRef<TextInput>(null);

  const { username, password, serverDomain, serverPort, showMoviesSlider, useProxy } = useSelector(
    (s: RootState) => s.user,
  );
  const {
    movieCategories,
    movieList,
    loadingCategories,
    loadingMovies,
    error,
  } = useSelector((s: RootState) => s.iptv);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [watchProgress, setWatchProgress] = useState<Record<string, any>>({});

  /* ─── Fetch categories once */
  useEffect(() => {
    dispatch(
      fetchMovieCategories({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        useProxy,
      }),
    );
  }, [dispatch, username, password, serverDomain, serverPort]);

  /* ─── When categories arrive, fetch first category */
  useEffect(() => {
    if (!loadingCategories && movieCategories.length && !activeCategory) {
      const first = movieCategories[0];
      setActiveCategory(first.category_id);
      setActiveCategoryName(first.category_name);
      dispatch(
        fetchMoviesInCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId: first.category_id,
          useProxy,
        }),
      );
    }
  }, [loadingCategories, movieCategories]);

  // Load watch progress when component mounts
  useEffect(() => {
    const loadProgress = async () => {
      const progressMap: Record<string, any> = {};
      for (const movie of movieList) {
        const progress = await storage.getWatchProgress(movie.stream_id.toString(), true);
        if (progress) {
          progressMap[movie.stream_id] = progress;
        }
      }
      setWatchProgress(progressMap);
    };
    loadProgress();
  }, [movieList]);

  const handleCategorySelect = useCallback(
    (categoryId: string, categoryName: string) => {
      if (categoryId === activeCategory) return;
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
          useProxy,
        }),
      );
    },
    [dispatch, username, password, serverDomain, serverPort, activeCategory],
  );

  /* ─── Derived data */
  const movies = Array.isArray(movieList) ? movieList : [];

  const featuredMovies = useMemo(() => {
    if (movies.length < 1) return [];
    return [...movies].sort(() => 0.5 - Math.random()).slice(0, 5);
  }, [movies]);

  const filteredMovies = movies.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()),
  );

  /* ─── Helper components */
  const Poster = ({ uri, style }: { uri?: string; style: any }) => {
    const icon = uri ? proxyStreamUrl(uri, useProxy) : null;
    return icon ? (
      <FastImage
        style={style}
        source={{ uri: icon, priority: FastImage.priority.normal }}
        resizeMode={FastImage.resizeMode.cover}
      />
    ) : (
      <View style={[style, styles.placeholder]}>
        <FontAwesome5 name="film" size={28} color="#A0ABC0" />
      </View>
    );
  };

  const renderMovie = ({ item }: { item: any }) => {
    const progress = watchProgress[item.stream_id];
    const progressPercent = progress ? (progress.progress / progress.totalDuration) * 100 : 0;

    return (
      <TouchableOpacity
        style={styles.channelCard}
        onPress={() => {
          try {
            if (!item.stream_id) {
              if (__DEV__) console.warn('Movie stream_id is missing');
              Alert.alert('Movie stream_id is missing');
              return;
            }
            setSelectedMovie(item);
          } catch (error) {
            if (__DEV__) console.error('Error selecting movie:', error);
            Alert.alert('Error selecting movie:' + error);
          }
        }}
        activeOpacity={0.7}>
        <View style={item.stream_icon ? styles.cardGlowingBorder : styles.cardGlowingBorderPlaceholder}>
          <View style={styles.cardImageContainer}>
            <Poster uri={item.stream_icon?.trim()} style={styles.cardImage} />
            <View style={styles.playBadge}>
              <FontAwesome5 name="play" size={10} color="#fff" />
            </View>
            {progress && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            )}
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ─── Loading / error */
  if (loadingCategories || !activeCategory) {
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
      </View>
    );
  }

  /* ─── UI */
  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.goBack()}>
            <FontAwesome5 name="arrow-left" size={18} color="#fff" />
            <Text style={styles.headerTitle}> Movies</Text>
          </TouchableOpacity>
        </View>

        {/* Toolbar (Category + Search) */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={styles.toolbarContainer}>
          {/* Active category chip */}
          <TouchableOpacity
            style={styles.categoryChip}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.75}>
            <FontAwesome5
              name="film"
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
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search movies..."
              placeholderTextColor="#A0ABC0"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>
        </Animated.View>

        <View style={styles.contentContainer}>
          {/* Featured slider */}
          {showMoviesSlider && featuredMovies?.length > 0 && (
            <View style={styles.sliderWrapper}>
              <Swiper
                autoplay
                showsPagination
                dotColor="rgba(255,255,255,0.4)"
                activeDotColor="#4A90E2">
                {featuredMovies?.map(m => (
                  <TouchableOpacity
                    key={`${activeCategory}-${m.stream_id}`}
                    style={styles.sliderSlide}
                    onPress={() => setSelectedMovie(m)}
                    activeOpacity={0.9}>
                    <Poster
                      uri={m.stream_icon?.trim()}
                      style={styles.sliderImage}
                    />
                    <View style={styles.featuredOverlay}>
                      <Text style={styles.featuredTitle}>{m.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </Swiper>
            </View>
          )}

          {/* Movie grid */}
          {loadingMovies ? (
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
              keyExtractor={i => i.stream_id.toString()}
              renderItem={renderMovie}
              numColumns={3}
              columnWrapperStyle={{
                justifyContent: 'space-between',
              }}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={12}
              windowSize={5}
              initialNumToRender={12}
            />
          )}
        </View>

        {/* Category Modal */}
        <CategoryPickerModal
          visible={showCategoryModal}
          categories={movieCategories as any}
          activeCategory={activeCategory}
          onSelect={handleCategorySelect}
          onClose={() => setShowCategoryModal(false)}
        />

        {/* Detail modal */}
        <Modal
          visible={!!selectedMovie}
          animationType="slide"
          onRequestClose={() => setSelectedMovie(null)}
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContentWrapper, { paddingTop: insets.top }]}>
              {selectedMovie &&
                (() => {
                  const addedDate = selectedMovie.added
                    ? new Date(
                      Number(selectedMovie.added) * 1000,
                    ).toLocaleDateString()
                    : '';
                  return (
                    <View style={styles.modalCard}>
                      <TouchableOpacity
                        style={styles.modalClose}
                        onPress={() => setSelectedMovie(null)}>
                        <FontAwesome5 name="times" size={18} color="#fff" />
                      </TouchableOpacity>
                      <Poster
                        uri={selectedMovie.stream_icon?.trim()}
                        style={styles.modalPoster}
                      />

                      <View style={styles.modalBody}>
                        <Text style={styles.modalTitle}>{selectedMovie.name}</Text>
                        <View style={styles.metaRow}>
                          <FontAwesome5 name="star" size={14} color="#FFD700" />
                          <Text style={styles.metaText}>
                            {' '}
                            {selectedMovie.rating_5based || selectedMovie.rating}/5
                          </Text>
                          {addedDate ? (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <Text style={styles.metaText}>{addedDate}</Text>
                            </>
                          ) : null}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.playButton}
                        onPress={() => {
                          try {
                            if (!selectedMovie.stream_id) {
                              if (__DEV__) console.warn('Movie stream_id is missing');
                              return;
                            }
                            const ext =
                              selectedMovie.container_extension?.replace('.', '') ||
                              'mp4';
                            const originalUrl = buildMovieStreamUrl({
                              domain: serverDomain,
                              port: serverPort,
                              username,
                              password,
                              streamId: selectedMovie.stream_id,
                              extension: ext,
                            });
                            const url = proxyStreamUrl(originalUrl, useProxy);
                            setSelectedMovie(null);
                            navigation.navigate('VideoPlayer', {
                              streamUrl: url,
                              isLive: false,
                              title: selectedMovie.name || 'Unknown Movie',
                              movieId: selectedMovie.stream_id.toString(),
                              continueTime: watchProgress[selectedMovie.stream_id],
                              thumbnail: selectedMovie.stream_icon,
                            });
                          } catch (error) {
                            if (__DEV__) console.error('Error playing movie:', error);
                            setSelectedMovie(null);
                          }
                        }}>
                        <FontAwesome5 name="play" size={16} color="#fff" />
                        <Text style={styles.playText}>Play Movie</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default MoviesScreen;

/* ─────────────────────────────── Styles */
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
  emptyText: {
    color: '#A0ABC0',
    fontSize: 14,
    marginTop: 12,
  },

  /* Header */
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

  /* Toolbar (category chip + search) */
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

  /* Slider */
  sliderWrapper: {
    height: 200,
    marginBottom: 12,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sliderSlide: {
    flex: 1,
  },
  sliderImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  /* Grid */
  grid: {
    paddingTop: 4,
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
    height: CARD_HEIGHT,
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
  cardGlowingBorderPlaceholder: {
    width: CARD_SIZE,
    height: CARD_HEIGHT,
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
  cardImageContainer: {
    width: CARD_SIZE - 6,
    height: CARD_HEIGHT - 6,
    backgroundColor: '#111',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
  },
  placeholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },

  /* Detail Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentWrapper: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalPoster: {
    width: '100%',
    height: 300
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalBody: {
    padding: 20
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: { color: '#A0ABC0', fontSize: 14 },
  metaDot: { color: '#A0ABC0', marginHorizontal: 6 },

  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
  },
  playText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 16
  },

  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E53935',
  },
});
