import React, {useEffect, useState, useRef, useMemo} from 'react';
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
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Swiper from 'react-native-swiper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import {useSelector, useDispatch} from 'react-redux';
import {RootState, AppDispatch} from '../store';
import {fetchSeries, fetchSeriesByCategory} from '../store/slices/iptvSlice';

const {width} = Dimensions.get('window');
const GAP = 12;
const CARD_W = (width - GAP * 4) / 3; // 3‑column grid

const SeriesHomeScreen: React.FC<any> = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const searchRef = useRef<TextInput>(null);

  /* Redux state ---------------------------------------------------- */
  const {username, password, serverDomain, serverPort} = useSelector(
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

  /* Fetch categories on mount -------------------------------------- */
  useEffect(() => {
    dispatch(
      fetchSeries({username, password, domain: serverDomain, port: serverPort}),
    );
  }, [dispatch, username, password, serverDomain, serverPort]);

  /* When categories arrive fetch first cat ------------------------- */
  useEffect(() => {
    if (!loadingCategories && seriesCategories.length && !activeCategory) {
      const first = seriesCategories[0].category_id;
      changeCategory(first);
    }
  }, [loadingCategories, seriesCategories]);

  const changeCategory = (catId: string) => {
    setActiveCategory(catId);
    dispatch(
      fetchSeriesByCategory({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        categoryId: catId,
      }),
    );
  };

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
  const PosterCard = ({item}: {item: any}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('SeriesDetail', {
          seriesId: item.series_id,
          seriesName: item.name,
          baseInfo: item, // << pass whole object
        })
      }>
      <FastImage
        style={styles.cardImage}
        source={{uri: item.cover, priority: FastImage.priority.normal}}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View style={styles.ratingBadge}>
        <FontAwesome5 name="star" size={10} color="#FFD700" />
        <Text style={styles.ratingText}>
          {item.rating_5based || item.rating}
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  /* UI ------------------------------------------------------------- */
  if (loadingCategories || loadingSeries)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );

  if (error)
    return (
      <View style={styles.center}>
        <Text style={{color: 'red'}}>{error}</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* ───── Header ───── */}
      <View style={[styles.header, {paddingTop: insets.top + 4}]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Series</Text>
        <View style={{width: 16}} />
      </View>

      {/* ───── Search ───── */}
      <View style={styles.searchWrap}>
        <FontAwesome5
          name="search"
          size={14}
          color="#777"
          style={{marginRight: 8}}
        />
        <TextInput
          ref={searchRef}
          placeholder="Search series..."
          placeholderTextColor="#999"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <FontAwesome5 name="times-circle" size={16} color="#777" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ───── Categories ───── */}
      <View>
        <FlatList
          data={seriesCategories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c.category_id.toString()}
          renderItem={({item}) => {
            const active = item.category_id === activeCategory;
            return (
              <TouchableOpacity
                style={[styles.genrePill, active && styles.genrePillActive]}
                onPress={() => changeCategory(item.category_id)}>
                <Text
                  style={[styles.genreText, active && styles.genreTextActive]}
                  numberOfLines={1}>
                  {item.category_name}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{paddingHorizontal: 8, paddingVertical: 8}}
        />
      </View>
      <ScrollView contentContainerStyle={{paddingBottom: 5}}>
        {/* ───── Trending slider ───── */}
        {trending.length > 0 && (
          <View style={styles.sliderWrapper}>
            <Swiper
              autoplay
              showsPagination
              dotColor="#fff"
              activeDotColor="#4A90E2">
              {trending.map(s => (
                <TouchableOpacity
                  key={s.series_id.toString()}
                  style={{flex: 1}}
                  onPress={() =>
                    navigation.navigate('SeriesDetail', {
                      seriesId: s.series_id,
                      seriesName: s.name,
                      baseInfo: s,
                    })
                  }>
                  <FastImage
                    style={{width: '100%', height: '100%'}}
                    source={{uri: s.backdrop_path[0]}}
                    resizeMode={FastImage.resizeMode.cover}
                  />
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
              ))}
            </Swiper>
          </View>
        )}

        {/* ───── Recently Added grid ───── */}
        {recentlyAdded.length > 0 && (
          <FlatList
            data={recentlyAdded}
            keyExtractor={i => i.series_id.toString()}
            renderItem={({item}) => <PosterCard item={item} />}
            numColumns={3}
            columnWrapperStyle={{
              justifyContent: 'space-between',
              marginBottom: GAP,
            }}
            contentContainerStyle={{paddingHorizontal: GAP, marginTop: 24}}
          />
        )}

        {/* ───── Most Watched grid ───── */}
        {mostWatched.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Most Watched</Text>
            <FlatList
              data={mostWatched}
              keyExtractor={i => i.series_id.toString()}
              renderItem={({item}) => <PosterCard item={item} />}
              numColumns={3}
              columnWrapperStyle={{
                justifyContent: 'space-between',
                marginBottom: GAP,
              }}
              contentContainerStyle={{paddingHorizontal: GAP}}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default SeriesHomeScreen;

/* ───────────────────────────── Styles */
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F3F4F6'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D3B55',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: 'bold'},

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  searchInput: {flex: 1, height: 40, fontSize: 14},

  /* Category pills */
  genrePill: {
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eee',
    borderRadius: 20,
    marginRight: 8,
  },
  genrePillActive: {backgroundColor: '#4A90E2'},
  genreText: {fontSize: 13, color: '#555'},
  genreTextActive: {color: '#fff', fontWeight: '600'},

  /* Slider */
  sliderWrapper: {height: 180, marginTop: 12},
  trendOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  trendMeta: {position: 'absolute', bottom: 12, left: 12, right: 12},
  trendTitle: {color: '#fff', fontSize: 18, fontWeight: '700'},
  trendRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  trendRating: {color: '#fff', marginLeft: 4},

  /* Section title */
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3B55',
    marginLeft: 16,
    marginTop: 24,
    marginBottom: 8,
  },

  /* Cards */
  card: {width: CARD_W, marginBottom: GAP},
  cardImage: {width: '100%', height: CARD_W * 1.5, borderRadius: 8},
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {color: '#fff', fontSize: 10, marginLeft: 2},
  cardTitle: {marginTop: 4, fontSize: 12, color: '#2D3B55'},
});
