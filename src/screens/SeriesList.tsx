import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  ImageBackground,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Swiper from 'react-native-swiper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchSeries, fetchSeriesByCategory } from '../store/slices/iptvSlice';
import CategoryPickerModal from '../components/CategoryPickerModal';

const backgroundImage = require('../assets/background-image-mobile.png');

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 56) / 3;
const CARD_HEIGHT = CARD_SIZE * 1.5; // 2:3 aspect ratio

const SeriesHomeScreen: React.FC<any> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const searchRef = useRef<TextInput>(null);

  /* Redux state ---------------------------------------------------- */
  const { username, password, serverDomain, serverPort, showSeriesSlider } = useSelector(
    (s: RootState) => s.user,
  );
  const {
    seriesCategories,
    seriesList,
    loadingCategories,
    loadingSeries,
    error,
  } = useSelector((s: RootState) => s.iptv);

  /* Local state ---------------------------------------------------- */
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  /* Fetch categories on mount -------------------------------------- */
  useEffect(() => {
    dispatch(
      fetchSeries({ username, password, domain: serverDomain, port: serverPort }),
    );
  }, [dispatch, username, password, serverDomain, serverPort]);

  /* When categories arrive fetch first cat ------------------------- */
  useEffect(() => {
    if (!loadingCategories && seriesCategories.length && !activeCategory) {
      const first = seriesCategories[0];
      changeCategory(first.category_id, first.category_name);
    }
  }, [loadingCategories, seriesCategories]);

  const changeCategory = useCallback((categoryId: string, categoryName: string) => {
    if (categoryId === activeCategory) return;
    setActiveCategory(categoryId);
    setActiveCategoryName(categoryName);
    setShowCategoryModal(false);
    setSearch('');
    dispatch(
      fetchSeriesByCategory({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        categoryId,
      }),
    );
  }, [dispatch, username, password, serverDomain, serverPort, activeCategory]);

  /* Derived lists -------------------------------------------------- */
  const filtered = useMemo(
    () =>
      seriesList.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [seriesList, search],
  );

  if (__DEV__) console.log('filtered ===>', filtered)

  const trending = filtered.filter(item => item.backdrop_path?.[0]).slice(0, 5);
  const recentlyAdded = [...filtered].sort(
    (a, b) => Number(b.added) - Number(a.added),
  );
  const mostWatched = [...filtered].sort(
    (a, b) => (b.rating_5based || 0) - (a.rating_5based || 0),
  );

  /* Card component ------------------------------------------------- */
  const PosterCard = ({ item }: { item: any }) => {
    const icon = item.cover
      ? `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(item.cover)}`
      : null;

    return (
      <TouchableOpacity
        style={styles.channelCard}
        onPress={() =>
          navigation.navigate('SeriesDetail', {
            seriesId: item.series_id,
            seriesName: item.name,
            baseInfo: item, // pass whole object
          })
        }
        activeOpacity={0.7}>
        <View style={icon ? styles.cardGlowingBorder : styles.cardGlowingBorderPlaceholder}>
          <View style={styles.cardImageContainer}>
            {icon ? (
              <FastImage
                style={styles.cardImage}
                source={{ uri: icon, priority: FastImage.priority.normal }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <FontAwesome5 name="film" size={28} color="#A0ABC0" />
            )}
            <View style={styles.ratingBadge}>
              <FontAwesome5 name="star" size={10} color="#FFD700" />
              <Text style={styles.ratingText}>
                {item.rating_5based || item.rating || "0.0"}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  /* UI ------------------------------------------------------------- */
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
            <Text style={styles.headerTitle}> Series</Text>
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
              name="tv"
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
              placeholder="Search series..."
              placeholderTextColor="#A0ABC0"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>
        </Animated.View>

        <View style={styles.contentContainer}>
          <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            {loadingSeries ? (
              <View style={[styles.center, { marginTop: 40 }]}>
                <ActivityIndicator size="large" color="#4A90E2" />
              </View>
            ) : filtered.length === 0 ? (
              <View style={[styles.center, { marginTop: 80 }]}>
                <FontAwesome5 name="tv" size={40} color="#A0ABC0" />
                <Text style={styles.emptyText}>No series found</Text>
              </View>
            ) : (
              <>
                {/* ───── Trending slider ───── */}
                {showSeriesSlider && trending.length > 0 && (
                  <View style={styles.sliderWrapper}>
                    <Swiper
                      autoplay
                      showsPagination
                      dotColor="rgba(255,255,255,0.4)"
                      activeDotColor="#4A90E2">
                      {trending.map(s => {
                        const bgUri = s.backdrop_path?.[0]
                          ? `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(s.backdrop_path[0])}`
                          : null;
                        return (
                          <TouchableOpacity
                            key={s.series_id.toString()}
                            style={styles.sliderSlide}
                            onPress={() =>
                              navigation.navigate('SeriesDetail', {
                                seriesId: s.series_id,
                                seriesName: s.name,
                                baseInfo: s,
                              })
                            }>
                            {bgUri && (
                              <FastImage
                                style={styles.sliderImage}
                                source={{ uri: bgUri }}
                                resizeMode={FastImage.resizeMode.cover}
                              />
                            )}
                            <View style={styles.trendOverlay} />
                            <View style={styles.trendMeta}>
                              <Text style={styles.trendTitle}>{s.name}</Text>
                              <View style={styles.trendRow}>
                                <FontAwesome5 name="star" size={12} color="#FFD700" />
                                <Text style={styles.trendRating}>
                                  {s.rating_5based || s.rating}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </Swiper>
                  </View>
                )}

                {/* ───── Recently Added grid ───── */}
                {recentlyAdded.length > 0 && (
                  <FlatList
                    scrollEnabled={false}
                    data={recentlyAdded}
                    keyExtractor={i => i.series_id.toString()}
                    renderItem={({ item }) => <PosterCard item={item} />}
                    numColumns={3}
                    columnWrapperStyle={{
                      justifyContent: 'space-between',
                    }}
                    contentContainerStyle={styles.grid}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                  />
                )}

                {/* ───── Most Watched grid ───── */}
                {mostWatched.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Most Watched</Text>
                    <FlatList
                      scrollEnabled={false}
                      data={mostWatched}
                      keyExtractor={i => i.series_id.toString()}
                      renderItem={({ item }) => <PosterCard item={item} />}
                      numColumns={3}
                      columnWrapperStyle={{
                        justifyContent: 'space-between',
                      }}
                      contentContainerStyle={styles.grid}
                      initialNumToRender={6}
                      maxToRenderPerBatch={6}
                    />
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {/* Category Modal */}
        <CategoryPickerModal
          visible={showCategoryModal}
          categories={seriesCategories as any}
          activeCategory={activeCategory}
          onSelect={changeCategory}
          onClose={() => setShowCategoryModal(false)}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

export default SeriesHomeScreen;

/* ───────────────────────────── Styles */
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
    marginBottom: 20,
    marginHorizontal: 12,
    marginTop: 4,
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
  trendOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  trendMeta: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16
  },
  trendTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700'
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  trendRating: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500'
  },

  /* Section title */
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* Cards Grid */
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 8,
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
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 4,
    fontWeight: 'bold'
  },
  cardTitle: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
  },
});
