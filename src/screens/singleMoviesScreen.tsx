import React, {
  useEffect,
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
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Modal,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  XtreamMovieStream,
  XtreamSession,
} from '../services/xtream/xtreamService';
import { storage } from '../utils/storage';
import { proxyStreamUrl } from '../utils/proxy';
import { buildMovieStreamUrl } from '../utils/xtream';
import { colors, sectionAccents, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import CategoryDropdown from '../components/mirror/CategoryDropdown';
import {
  CatalogGridSkeleton,
  CatalogStatus,
} from '../components/catalog/CatalogStates';
import { useCatalogViewState } from '../hooks/useCatalogViewState';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTmdbDetails, useTmdbMatch } from '../hooks/useTmdbMatch';
import { getTenPointRating } from '../utils/rating';
import type { TabScreenProps } from '../navigation/types';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const ACCENT = sectionAccents.movies;
const { width } = Dimensions.get('window');
const H_PAD = 20;
const GUTTER = 12;
const COLUMNS = 3;
const ITEM_WIDTH = (width - H_PAD * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;
const POSTER_HEIGHT = ITEM_WIDTH * 1.5; // 2:3 portrait
const EMPTY_CATEGORIES: XtreamCategory[] = [];
const EMPTY_MOVIES: XtreamMovieStream[] = [];
const movieKeyExtractor = (item: XtreamMovieStream) => String(item.stream_id);

// ─────────────────────────────────────────────────────────────
// Movie poster card — portrait 2:3, scrim title, rating badge
// ─────────────────────────────────────────────────────────────
const MoviePoster = React.memo(
  ({
    streamId,
    name,
    streamIcon,
    releaseYear,
    ratingValue,
    onPressMovie,
    useProxy,
    progressPercent,
  }: {
    streamId: number;
    name: string;
    streamIcon?: string;
    releaseYear?: string | number;
    ratingValue?: string | number;
    onPressMovie: (streamId: number) => void;
    useProxy: boolean;
    progressPercent: number;
  }) => {
    const xtreamYear =
      releaseYear && /^\d{4}$/.test(String(releaseYear))
        ? String(releaseYear)
        : null;

    const raw = streamIcon?.trim();
    const posterUri = raw ? proxyStreamUrl(raw, useProxy) : null;
    const rating = getTenPointRating(ratingValue);
    const handlePress = useCallback(
      () => onPressMovie(streamId),
      [onPressMovie, streamId],
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
              <FontAwesome5 name="film" size={26} color={colors.fgSubtle} />
            </View>
          )}

          {!!xtreamYear && (
            <View style={styles.yearBadge}>
              <Text style={styles.yearText}>{xtreamYear}</Text>
            </View>
          )}

          {rating != null && (
            <View style={styles.ratingBadge}>
              <FontAwesome5 name="star" size={9} color={colors.warning} solid />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}

          {/* title scrim */}
          <LinearGradient
            colors={['transparent', 'rgba(6,8,16,0.55)', 'rgba(6,8,16,0.92)']}
            style={styles.scrim}
            pointerEvents="none"
          >
            <Text style={styles.posterTitle} numberOfLines={3}>
              {name}
            </Text>
          </LinearGradient>

          {progressPercent > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progressPercent}%` }]}
              />
            </View>
          )}
        </View>

      </TouchableOpacity>
    );
  },
);

const MoviesScreen: React.FC<TabScreenProps<'Movies'>> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [watchProgress, setWatchProgress] = useState<Record<string, any>>({});

  const categoriesQuery = useXtreamCategories(session, 'movie');
  const movieCategories = categoriesQuery.data ?? EMPTY_CATEGORIES;
  const {
    activeCategoryId: activeCategory,
    activeCategoryName,
    selectCategory,
    contentOffset,
    onScroll,
    listKey,
  } = useCatalogViewState({
    playlistId,
    mediaType: 'movie',
    categories: movieCategories,
    categoriesReady: categoriesQuery.isSuccess,
  });
  const moviesQuery = useXtreamCategoryContent(
    session,
    'movie',
    activeCategory,
  );
  const movieList = moviesQuery.data ?? EMPTY_MOVIES;
  const loadingCategories = categoriesQuery.isPending;
  const loadingMovies = moviesQuery.isPending;
  const error = getXtreamErrorMessage(
    categoriesQuery.error ?? moviesQuery.error,
  );
  const { isOffline } = useNetworkStatus();
  const {
    isError: categoriesError,
    isRefetching: refreshingCategories,
    refetch: refetchCategories,
  } = categoriesQuery;
  const {
    isError: moviesError,
    isRefetching: refreshingMovies,
    refetch: refetchMovies,
  } = moviesQuery;

  // load watch progress for the current list
  useEffect(() => {
    const loadProgress = async () => {
      const progressMap: Record<string, any> = {};
      for (const movie of movieList) {
        const progress = await storage.getWatchProgress(
          movie.stream_id.toString(),
          true,
        );
        if (progress) {
          progressMap[movie.stream_id] = progress;
        }
      }
      setWatchProgress(progressMap);
    };
    loadProgress();
  }, [movieList]);

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

  const movies = useMemo(
    () => (Array.isArray(movieList) ? movieList : []),
    [movieList],
  );
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredMovies = useMemo(
    () =>
      normalizedSearch
        ? movies.filter(m => m.name?.toLowerCase().includes(normalizedSearch))
        : movies,
    [movies, normalizedSearch],
  );

  const handleMoviePress = useCallback(
    (streamId: number) => {
      const movie = movies.find(item => item.stream_id === streamId);
      if (!movie) {
        if (__DEV__) console.warn('Movie stream_id is missing');
        Alert.alert('Movie is unavailable');
        return;
      }
      setSelectedMovie(movie);
    },
    [movies],
  );

  const renderMovie = useCallback(
    ({ item }: { item: XtreamMovieStream }) => {
      const progress = watchProgress[item.stream_id];
      const progressPercent =
        progress && progress.totalDuration
          ? Math.max(
              0,
              Math.min(100, (progress.progress / progress.totalDuration) * 100),
            )
          : 0;

      return (
        <MoviePoster
          streamId={item.stream_id}
          name={item.name}
          streamIcon={item.stream_icon}
          releaseYear={item.year}
          ratingValue={item.rating}
          useProxy={useProxy}
          progressPercent={progressPercent}
          onPressMovie={handleMoviePress}
        />
      );
    },
    [handleMoviePress, useProxy, watchProgress],
  );

  const handleRefresh = useCallback(() => {
    refetchCategories();
    if (activeCategory) {
      refetchMovies();
    }
  }, [activeCategory, refetchCategories, refetchMovies]);

  const handleRetry = useCallback(() => {
    if (categoriesError || movieCategories.length === 0) {
      refetchCategories();
    }
    if (activeCategory && (moviesError || movies.length === 0)) {
      refetchMovies();
    }
  }, [
    activeCategory,
    categoriesError,
    movieCategories,
    movies,
    moviesError,
    refetchCategories,
    refetchMovies,
  ]);

  const handleListScroll = useCallback(
    (event: Parameters<typeof onScroll>[0]) => {
      if (!normalizedSearch) {
        onScroll(event);
      }
    },
    [normalizedSearch, onScroll],
  );

  const playSelected = () => {
    if (!selectedMovie?.stream_id) {
      setSelectedMovie(null);
      return;
    }
    try {
      const ext =
        selectedMovie.container_extension?.replace('.', '') || 'mp4';
      const originalUrl = buildMovieStreamUrl({
        domain: serverDomain,
        port: serverPort,
        username,
        password,
        streamId: selectedMovie.stream_id,
        extension: ext,
      });
      const url = proxyStreamUrl(originalUrl, useProxy);
      const movie = selectedMovie;
      setSelectedMovie(null);
      navigation.navigate('VideoPlayer', {
        streamUrl: url,
        streamId: movie.stream_id.toString(),
        containerExtension: ext,
        isLive: false,
        title: movie.name || 'Unknown Movie',
        movieId: movie.stream_id.toString(),
        continueTime: watchProgress[movie.stream_id],
        thumbnail: movie.stream_icon,
      });
    } catch (e) {
      if (__DEV__) console.error('Error playing movie:', e);
      setSelectedMovie(null);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <CategoryDropdown
        label="MOVIES"
        accent={ACCENT}
        icon="film"
        categories={movieCategories as any}
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
              placeholder="Search movies by title"
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
            ? `${filteredMovies.length} result${
                filteredMovies.length === 1 ? '' : 's'
              }`
            : `${movies.length} titles`}
        </Text>
      </View>
    </View>
  );

  const addedDate = selectedMovie?.added
    ? new Date(Number(selectedMovie.added) * 1000).toLocaleDateString()
    : '';
  const selRating = selectedMovie ? parseFloat(selectedMovie.rating) : NaN;

  const selectedYear =
    selectedMovie?.year && /^\d{4}$/.test(String(selectedMovie.year))
      ? parseInt(String(selectedMovie.year), 10)
      : undefined;
  const { media: selectedTmdbMatch } = useTmdbMatch({
    title: selectedMovie?.name,
    year: selectedYear,
    type: 'movie',
    enabled: Boolean(selectedMovie),
  });
  const { details: selectedTmdbDetails } = useTmdbDetails({
    id: selectedTmdbMatch?.id,
    type: 'movie',
    enabled: Boolean(selectedTmdbMatch?.id),
  });

  const modalPosterUri =
    (selectedMovie?.stream_icon
      ? proxyStreamUrl(selectedMovie.stream_icon.trim(), useProxy)
      : null) ||
    selectedTmdbDetails?.poster ||
    selectedTmdbMatch?.poster ||
    null;
  const modalBackdropUri =
    selectedTmdbDetails?.backdrop || selectedTmdbMatch?.backdrop || null;
  const modalRating =
    (!Number.isNaN(selRating) && selRating > 0 ? selRating : null) ??
    selectedTmdbDetails?.rating ??
    selectedTmdbMatch?.rating ??
    null;
  const modalOverview =
    selectedTmdbDetails?.overview || selectedTmdbMatch?.overview || null;
  const modalGenres = selectedTmdbDetails?.genres ?? [];
  const modalCast = selectedTmdbDetails?.cast ?? [];
  const modalReleaseYear =
    selectedYear ||
    (selectedTmdbDetails?.releaseDate
      ? selectedTmdbDetails.releaseDate.substring(0, 4)
      : selectedTmdbMatch?.releaseDate
        ? selectedTmdbMatch.releaseDate.substring(0, 4)
        : null);

  // ---------- render ---------- //
  if (isOffline && movieCategories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="offline"
            title="You’re offline"
            message="Reconnect to load movie categories that are not cached yet."
            accent={ACCENT}
            onRetry={handleRetry}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (categoriesError && movieCategories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="error"
            title="Couldn’t load movies"
            message={error}
            accent={ACCENT}
            onRetry={handleRetry}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (loadingCategories && movieCategories.length === 0) {
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

  if (categoriesQuery.isSuccess && movieCategories.length === 0) {
    return (
      <View style={styles.root}>
        <AmbientGlow accent={ACCENT} />
        <SafeAreaView style={styles.centerSafe}>
          <CatalogStatus
            kind="empty"
            title="No movie categories"
            message="This playlist did not return any movie categories."
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
        {loadingMovies && movies.length === 0 ? (
          <CatalogGridSkeleton
            accent={ACCENT}
            itemWidth={ITEM_WIDTH}
            itemHeight={POSTER_HEIGHT}
            gutter={GUTTER}
          />
        ) : movies.length === 0 && (isOffline || moviesError) ? (
          <CatalogStatus
            kind={isOffline ? 'offline' : 'error'}
            title={isOffline ? 'You’re offline' : 'Couldn’t load movies'}
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
            data={filteredMovies}
            keyExtractor={movieKeyExtractor}
            renderItem={renderMovie}
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
                refreshing={refreshingCategories || refreshingMovies}
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
                  normalizedSearch ? 'No matching movies' : 'No movies found'
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

      {/* Detail modal */}
      <Modal
        visible={!!selectedMovie}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedMovie(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalWrap, { paddingTop: insets.top }]}>
            {selectedMovie && (
              <View style={styles.modalCard}>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setSelectedMovie(null)}
                >
                  <FontAwesome5 name="times" size={16} color={colors.fg} />
                </TouchableOpacity>

                {modalBackdropUri ? (
                  <FastImage
                    style={styles.modalPoster}
                    source={{
                      uri: modalBackdropUri,
                      priority: FastImage.priority.high,
                    }}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : modalPosterUri ? (
                  <FastImage
                    style={styles.modalPoster}
                    source={{
                      uri: modalPosterUri,
                      priority: FastImage.priority.high,
                    }}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <View style={[styles.modalPoster, styles.posterPlaceholder]}>
                    <FontAwesome5 name="film" size={40} color={colors.fgSubtle} />
                  </View>
                )}

                <View style={styles.modalBody}>
                  <Text style={styles.modalTitle}>{selectedMovie.name}</Text>
                  <View style={styles.modalMetaRow}>
                    {modalRating != null && (
                      <>
                        <FontAwesome5
                          name="star"
                          size={13}
                          color={colors.warning}
                          solid
                        />
                        <Text style={styles.modalMetaText}>
                          {' '}
                          {modalRating.toFixed(1)}
                        </Text>
                      </>
                    )}
                    {!!modalReleaseYear && (
                      <>
                        {modalRating != null && (
                          <Text style={styles.modalMetaDot}>·</Text>
                        )}
                        <Text style={styles.modalMetaText}>
                          {modalReleaseYear}
                        </Text>
                      </>
                    )}
                    {!!addedDate && (
                      <>
                        {(modalRating != null || !!modalReleaseYear) && (
                          <Text style={styles.modalMetaDot}>·</Text>
                        )}
                        <Text style={styles.modalMetaText}>{addedDate}</Text>
                      </>
                    )}
                  </View>

                  {modalGenres.length > 0 && (
                    <View style={styles.genreRow}>
                      {modalGenres.map(genre => (
                        <View key={genre} style={styles.genreChip}>
                          <Text style={styles.genreText}>{genre}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!!modalOverview && (
                    <Text style={styles.modalOverview}>{modalOverview}</Text>
                  )}

                  {modalCast.length > 0 && (
                    <View style={styles.castSection}>
                      <Text style={styles.castHeader}>Cast</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.castRow}
                      >
                        {modalCast.map(member => (
                          <View key={member.id} style={styles.castChip}>
                            {member.profile ? (
                              <FastImage
                                source={{ uri: member.profile }}
                                style={styles.castAvatar}
                              />
                            ) : (
                              <View style={styles.castAvatarPlaceholder}>
                                <FontAwesome5
                                  name="user"
                                  size={14}
                                  color={colors.fgSubtle}
                                />
                              </View>
                            )}
                            <Text style={styles.castName} numberOfLines={1}>
                              {member.name}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: ACCENT }]}
                  activeOpacity={0.85}
                  onPress={playSelected}
                >
                  <FontAwesome5 name="play" size={14} color={colors.scene} solid />
                  <Text style={styles.playText}>Play Movie</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MoviesScreen;

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
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  // detail modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalWrap: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalPoster: {
    width: '100%',
    height: 320,
    backgroundColor: colors.surface,
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(8,11,22,0.6)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalBody: {
    padding: 18,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '700',
    color: colors.fg,
    marginBottom: 8,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalMetaText: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 14,
  },
  modalMetaDot: {
    color: colors.fgSubtle,
    marginHorizontal: 8,
  },
  modalOverview: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  genreChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreText: {
    fontFamily: FONT,
    fontSize: 11,
    color: colors.fgMuted,
  },
  castSection: {
    marginTop: 16,
  },
  castHeader: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: colors.fg,
    marginBottom: 8,
  },
  castRow: {
    gap: 10,
    paddingRight: 8,
  },
  castChip: {
    width: 72,
    alignItems: 'center',
  },
  castAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  castAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  castName: {
    fontFamily: FONT,
    fontSize: 10,
    color: colors.fgMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  playText: {
    fontFamily: FONT,
    color: colors.scene,
    fontWeight: '700',
    fontSize: 15,
  },
});
