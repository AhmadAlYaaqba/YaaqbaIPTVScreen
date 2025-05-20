/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo } from 'react';
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
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Swiper from 'react-native-swiper';

import { RootState, AppDispatch } from '../store';
import {
  fetchMovieCategories,
  fetchMoviesInCategory,
} from '../store/slices/iptvSlice';
import { storage } from '../utils/storage';

const { width } = Dimensions.get('window');
const GAP = 12;
const CARD_W = (width - GAP * 3) / 2; // two‑column grid

/* ─────────────────────────────────────────────── Component */
const MoviesScreen: React.FC<any> = ({ navigation }) => {
  /* ─── Hooks / Redux */
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const searchRef = useRef<TextInput>(null);

  const { username, password, serverDomain, serverPort } = useSelector(
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
  const [search, setSearch] = useState('');
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
      }),
    );
  }, [dispatch, username, password, serverDomain, serverPort]);

  /* ─── When categories arrive, fetch first category */
  useEffect(() => {
    if (!loadingCategories && movieCategories.length && !activeCategory) {
      const first = movieCategories[0].category_id;
      setActiveCategory(first);
      dispatch(
        fetchMoviesInCategory({
          username,
          password,
          domain: serverDomain,
          port: serverPort,
          categoryId: first,
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

  const handleCategoryPress = (id: string) => {
    if (id === activeCategory) return;
    setActiveCategory(id);
    dispatch(
      fetchMoviesInCategory({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        categoryId: id,
      }),
    );
  };

  /* ─── Derived data */
  const featuredMovies = useMemo(() => {
    if (movieList.length < 1) return [];
    return [...movieList].sort(() => 0.5 - Math.random()).slice(0, 2);
  }, [movieList]);

  const filteredMovies = movieList.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  );

  /* ─── Helper components */
  const Poster = ({ uri, style }: { uri?: string; style: any }) =>
    uri ? (
      <FastImage
        style={style}
        source={{ uri, priority: FastImage.priority.normal }}
        resizeMode={FastImage.resizeMode.cover}
      />
    ) : (
      <View style={[style, styles.placeholder]}>
        <FontAwesome5 name="film" size={28} color="#bbb" />
      </View>
    );

  const renderCategory = ({ item }: { item: any }) => {
    const selected = item.category_id === activeCategory;
    return (
      <TouchableOpacity
        style={[styles.catPill, selected && styles.catPillActive]}
        onPress={() => handleCategoryPress(item.category_id)}>
        <Text
          style={[styles.catText, selected && styles.catTextActive]}
          numberOfLines={1}>
          {item.category_name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMovie = ({ item }: { item: any }) => {
    const progress = watchProgress[item.stream_id];
    const progressPercent = progress ? (progress.progress / progress.totalDuration) * 100 : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          try {
            if (!item.stream_id) {
              console.warn('Movie stream_id is missing');
              Alert.alert('Movie stream_id is missing');
              return;
            }
            setSelectedMovie(item);
          } catch (error) {
            console.error('Error selecting movie:', error);
            Alert.alert('Error selecting movie:' + error);
          }
        }}>
        <Poster uri={item.stream_icon?.trim()} style={styles.cardImage} />
        <View style={styles.playBadge}>
          <FontAwesome5 name="play" size={10} color="#fff" />
        </View>
        {progress && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        )}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ─── Loading / error */
  if (loadingCategories || !activeCategory)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  if (error)
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );

  /* ─── UI */
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Movies</Text>
        <View style={{ width: 16 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrap}>
          <FontAwesome5
            name="search"
            size={14}
            color="#777"
            style={{ marginRight: 8 }}
          />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            placeholder="Search movies..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Featured slider */}
      {featuredMovies?.length > 0 && (
        <View style={styles.sliderWrapper}>
          <Swiper
            autoplay
            showsPagination
            dotColor="#fff"
            activeDotColor="#4A90E2">
            {featuredMovies?.map(m => (
              <TouchableOpacity
                key={`${activeCategory}-${m.stream_id}`}
                style={{ flex: 1 }}
                onPress={() => setSelectedMovie(m)}>
                <Poster
                  uri={m.stream_icon?.trim()}
                  style={{ width: '100%', height: '100%' }}
                />
                <View style={styles.featuredOverlay}>
                  <Text style={styles.featuredTitle}>{m.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Swiper>
        </View>
      )}

      {/* Category pills */}
      <FlatList
        data={movieCategories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => i.category_id.toString()}
        renderItem={renderCategory}
        contentContainerStyle={styles.pillContainer}
      />

      {/* Movie grid */}
      {loadingMovies ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredMovies}
          keyExtractor={i => i.stream_id.toString()}
          renderItem={renderMovie}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: 'space-between',
            marginBottom: GAP,
          }}
          contentContainerStyle={{ paddingHorizontal: GAP, paddingBottom: 80 }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {/* Detail modal */}
      <Modal
        visible={!!selectedMovie}
        animationType="slide"
        onRequestClose={() => setSelectedMovie(null)}>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: '#fff' }}
          edges={['top', 'bottom']}>
          {selectedMovie &&
            (() => {
              const addedDate = selectedMovie.added
                ? new Date(
                    Number(selectedMovie.added) * 1000,
                  ).toLocaleDateString()
                : '';
              return (
                <>
                  <Poster
                    uri={selectedMovie.stream_icon?.trim()}
                    style={styles.modalPoster}
                  />
                  <TouchableOpacity
                    style={[styles.modalClose, { top: insets.top + 10 }]}
                    onPress={() => setSelectedMovie(null)}>
                    <FontAwesome5 name="times" size={18} color="#fff" />
                  </TouchableOpacity>

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
                    style={[
                      styles.playButton,
                      { paddingBottom: insets.bottom || 16 },
                    ]}
                    onPress={() => {
                      try {
                        if (!selectedMovie.stream_id) {
                          console.warn('Movie stream_id is missing');
                          return;
                        }
                        const ext =
                          selectedMovie.container_extension?.replace('.', '') ||
                          'mp4';
                        const url = `http://${serverDomain}:${serverPort}/movie/${username}/${password}/${selectedMovie.stream_id}.${ext}`;
                        setSelectedMovie(null);
                        navigation.navigate('VideoPlayer', {
                          streamUrl: url,
                          isLive: false,
                          title: selectedMovie.name || 'Unknown Movie',
                          movieId: selectedMovie.stream_id.toString(),
                        });
                      } catch (error) {
                        console.error('Error playing movie:', error);
                        setSelectedMovie(null);
                      }
                    }}>
                    <FontAwesome5 name="play" size={16} color="#fff" />
                    <Text style={styles.playText}>Play Movie</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default MoviesScreen;

/* ─────────────────────────────── Styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D3B55',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  /* Search */
  searchContainer: { backgroundColor: '#2D3B55' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, height: 40, fontSize: 14 },

  /* Slider */
  sliderWrapper: { height: 180, marginBottom: 12 },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  featuredTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },

  /* Category pills */
  pillContainer: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    height: 48,
    marginBottom: 36,
  },
  catPill: {
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eee',
    borderRadius: 20,
    marginRight: 8,
    alignSelf: 'center',
  },
  catPillActive: { backgroundColor: '#4A90E2' },
  catText: { fontSize: 13, color: '#555', textAlign: 'center' },
  catTextActive: { color: '#fff', fontWeight: '600' },

  /* Movie card */
  card: {
    width: CARD_W,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 2,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: CARD_W * 1.5 },
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
    padding: 8,
    fontSize: 13,
    color: '#2D3B55',
    textAlign: 'center',
  },

  /* Placeholder */
  placeholder: {
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Modal */
  modalPoster: { width: '100%', height: 250 },
  modalClose: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalBody: { flex: 1, padding: 16 },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3B55',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: { color: '#555', fontSize: 14 },
  metaDot: { color: '#555', marginHorizontal: 6 },

  /* Play bar */
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
  },
  playText: { color: '#fff', marginLeft: 8, fontWeight: '600' },

  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E53935',
  },
});
