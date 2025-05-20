import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets} from 'react-native-safe-area-context';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import {useDispatch, useSelector} from 'react-redux';
import {RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../RootNavigator';
import {RootState, AppDispatch} from '../store';
import {fetchSeriesInfo} from '../store/slices/iptvSlice';
import { storage } from '../utils/storage';

/* ───────────────────────────── Types */
export type SeriesDetailRouteProp = RouteProp<
  RootStackParamList,
  'SeriesDetail'
>;
export type SeriesDetailNavProp = StackNavigationProp<
  RootStackParamList,
  'SeriesDetail'
>;
interface Props {
  route: SeriesDetailRouteProp;
  navigation: SeriesDetailNavProp;
}

/* ───────────────────────────── Layout */
const {width} = Dimensions.get('window');
const THUMB_W = 120;
const THUMB_H = 80;
const GAP = 14;

/* ───────────────────────────── Component */
const SeriesDetailScreen: React.FC<Props> = ({route, navigation}) => {
  const {seriesId, seriesName, baseInfo} = route.params; // baseInfo comes from Home
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();

  const {username, password, serverDomain, serverPort} = useSelector(
    (s: RootState) => s.user,
  );
  const {selectedSeriesInfo, loading, error} = useSelector(
    (s: RootState) => s.iptv,
  );

  const [watchProgress, setWatchProgress] = useState<any>(null);

  /* Fetch full details */
  useEffect(() => {
    navigation.setOptions({title: seriesName});
    dispatch(
      fetchSeriesInfo({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        seriesId,
      }),
    );
  }, [seriesId]);

  /* Local state */
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  console.log('selectedSeriesInfo ==>', selectedSeriesInfo);
  const info = baseInfo ?? selectedSeriesInfo?.info ?? ({} as any);
  const episodes =
    selectedSeriesInfo?.episodes ?? ({} as Record<string, any[]>);
  const seasons = Object.keys(episodes);

  useEffect(() => {
    if (seasons.length && !selectedSeason) setSelectedSeason(seasons[0]);
  }, [seasons]);

  const currentEpisodes = useMemo(
    () => (selectedSeason ? episodes[selectedSeason] : []),
    [selectedSeason, episodes],
  );

  // Load watch progress when component mounts
  useEffect(() => {
    const loadProgress = async () => {
      if (seriesId) {
        const progress = await storage.getWatchProgress(seriesId);
        console.log('seriesId ===>', progress)
        setWatchProgress(progress);
      }
    };
    loadProgress();
  }, [seriesId]);

  /* Play episode */
  const playEpisode = (ep: any, index: number) => {
    if (!ep) return;
    const url = `http://${serverDomain}:${serverPort}/series/${username}/${password}/${
      ep.id
    }.${ep.container_extension || 'mp4'}`;
    
    navigation.navigate('VideoPlayer', {
      streamUrl: url,
      isLive: false,
      title: ep.title,
      seriesId: seriesId,
      episodeId: ep.id,
      episodeList: currentEpisodes,
      currentEpisodeIndex: index,
    });
  };

  // Render episode with continue watching indicator
  const renderEpisode = (ep: any, index: number) => {
    const isWatched = watchProgress?.episodeId === ep.id;
    const progress = isWatched ? (watchProgress.progress / watchProgress.totalDuration) * 100 : 0;

    return (
      <TouchableOpacity
        key={ep.id}
        style={styles.epCard}
        onPress={() => playEpisode(ep, index)}>
        <View style={styles.thumbWrapper}>
          {ep.info.movie_image ? (
            <FastImage
              source={{uri: ep.info.movie_image}}
              style={styles.thumbImg}
            />
          ) : (
            <View style={[styles.thumbImg, {backgroundColor: '#ccc'}]} />
          )}
          <View style={styles.thumbOverlay}>
            <FontAwesome5 name="play" size={14} color="#fff" />
          </View>
          {isWatched && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          )}
        </View>
        <Text style={styles.epTitle} numberOfLines={2}>
          {ep.title}
        </Text>
      </TouchableOpacity>
    );
  };

  /* Loading / error states */
  if (loading)
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

  /* Data helpers */
  const heroImg = info.backdrop_path?.[0] || info.cover;
  const rating = info.rating_5based || info.rating;
  const year = info.releaseDate?.substring(0, 4) || '';
  const castArr = info.cast
    ? info.cast.split(',').map((n: string) => n.trim())
    : [];

  /* ───────────────────────────── UI */
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{paddingBottom: 80}}>
        {/* ───── Hero banner ───── */}
        <View style={[styles.heroWrapper]}>
          {heroImg ? (
            <FastImage
              source={{uri: heroImg}}
              style={styles.heroImg}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.heroImg, {backgroundColor: '#888'}]} />
          )}
          <View style={styles.heroOverlay} />

          {/* Back button (safe‑area) */}
          <TouchableOpacity
            style={[styles.backBtn, {top: insets.top + 8}]}
            onPress={() => navigation.goBack()}>
            <FontAwesome5 name="arrow-left" size={16} color="#fff" />
          </TouchableOpacity>

          {/* Title over banner */}
          <View style={styles.nameWrapper}>
            <Text style={styles.seriesName} numberOfLines={1}>
              {info.name || seriesName}
            </Text>
          </View>

          {/* Meta + play */}
          <View style={styles.heroMeta}>
            <View style={styles.badgeRow}>
              {rating ? (
                <View style={styles.badge}>
                  <FontAwesome5 name="star" size={10} color="#FFD700" />
                  <Text style={styles.badgeText}>{rating}</Text>
                </View>
              ) : null}
              {year ? (
                <View style={styles.badgeOutline}>
                  <Text style={styles.badgeText}>{year}</Text>
                </View>
              ) : null}
              {info.genre ? (
                <View style={styles.badgeOutline}>
                  <Text style={styles.badgeText}>{info.genre}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.playRow}>
              <TouchableOpacity
                style={[styles.playBtn, {flex: 1}]}
                onPress={() => playEpisode(currentEpisodes[0], 0)}>
                <FontAwesome5 name="play" size={14} color="#fff" />
                <Text style={styles.playText}>Play</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.playBtn,
                  {width: 48, backgroundColor: 'rgba(255,255,255,0.2)'},
                ]}>
                <FontAwesome5 name="plus" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ───── Plot / description ───── */}
        {info.plot ? (
          <View style={styles.plotBox}>
            <Text style={styles.plotHeader}>Story</Text>
            <Text style={styles.plotText}>{info.plot}</Text>
          </View>
        ) : null}

        {/* ───── Cast chips (names only) ───── */}
        {castArr.length ? (
          <View style={styles.plotBox}>
            <Text style={styles.plotHeader}>Casts</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingVertical: 6,
              }}>
              {castArr.map((name, idx) => (
                <View key={idx} style={styles.castChip}>
                  <Text style={styles.castText}>{name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ───── Season selector ───── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 16, paddingVertical: 12}}>
          {seasons.map(num => {
            const active = num === selectedSeason;
            return (
              <TouchableOpacity
                key={num}
                style={[styles.seasonPill, active && styles.seasonPillActive]}
                onPress={() => setSelectedSeason(num)}>
                <Text
                  style={[
                    styles.seasonText,
                    active && styles.seasonTextActive,
                  ]}>{`Season ${num}`}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ───── Episodes grid ───── */}
        <View style={styles.episodeGrid}>
          {currentEpisodes.map((ep, index) => renderEpisode(ep, index))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SeriesDetailScreen;

/* ───────────────────────────── Styles */
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F3F4F6'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  /* Hero */
  heroWrapper: {width: '100%', height: 260},
  heroImg: {width: '100%', height: '100%'},
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrapper: {position: 'absolute', top: 60, right: 16},
  seriesName: {color: '#fff', fontSize: 22, fontWeight: '700'},

  heroMeta: {position: 'absolute', bottom: 12, left: 16, right: 16},
  badgeRow: {flexDirection: 'row', marginBottom: 8},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  badgeOutline: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  badgeText: {color: '#fff', fontSize: 10, marginLeft: 2},
  playRow: {flexDirection: 'row'},
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingVertical: 10,
    marginRight: 8,
  },
  playText: {color: '#fff', fontSize: 14, marginLeft: 6, fontWeight: '600'},

  /* Plot */
  plotBox: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  plotHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3B55',
    marginBottom: 4,
  },
  plotText: {color: '#444', fontSize: 13, lineHeight: 18},

  /* Cast chips */
  castChip: {
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  castText: {fontSize: 12, color: '#333'},

  /* Season pills */
  seasonPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eee',
    borderRadius: 20,
    marginRight: 8,
  },
  seasonPillActive: {backgroundColor: '#4A90E2'},
  seasonText: {fontSize: 13, color: '#555'},
  seasonTextActive: {color: '#fff', fontWeight: '600'},

  /* Episodes grid */
  episodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  epCard: {width: (width - GAP * 4) / 3, marginBottom: GAP},
  thumbWrapper: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 6,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  thumbImg: {width: '100%', height: '100%'},
  thumbOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  epTitle: {marginTop: 4, fontSize: 12, color: '#2D3B55', textAlign: 'center'},
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E53935',
  },
});
