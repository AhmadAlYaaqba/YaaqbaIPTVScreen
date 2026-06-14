import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { RootStackParamList } from '../../RootNavigator';
import { RootState, AppDispatch } from '../store';
import { fetchSeriesInfo } from '../store/slices/iptvSlice';
import { storage } from '../utils/storage';
import { proxyStreamUrl } from '../utils/proxy';
import { buildSeriesStreamUrl } from '../utils/xtream';
import { useTmdbDetails, useTmdbMatch } from '../hooks/useTmdbMatch';
import { getSeasonEpisodes } from '../services/tmdb';
import { SeasonEpisode, CastMember } from '../types/media';
import { colors, sectionAccents, radii } from '../theme/colors';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });
const ACCENT = sectionAccents.series; // cyan

export type SeriesDetailRouteProp = RouteProp<RootStackParamList, 'SeriesDetail'>;
export type SeriesDetailNavProp = StackNavigationProp<
  RootStackParamList,
  'SeriesDetail'
>;

interface WatchProgress {
  contentId: string;
  progress: number;
  timestamp: number;
  totalDuration: number;
  title: string;
  thumbnail?: string;
  seriesId?: string;
  episodeId?: string;
}

interface Props {
  route: SeriesDetailRouteProp;
  navigation: SeriesDetailNavProp;
}

const { width } = Dimensions.get('window');
const THUMB_W = 124;

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

function formatRemaining(p?: WatchProgress) {
  if (!p || !p.totalDuration) return null;
  const left = Math.max(0, p.totalDuration - p.progress);
  if (left < 30) return null;
  const min = Math.ceil(left / 60);
  return min >= 60
    ? `Continue · ${Math.floor(min / 60)}h ${min % 60}m left`
    : `Continue · ${min}m left`;
}

const SeriesDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { seriesId, seriesName, baseInfo } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();

  const { username, password, serverDomain, serverPort, useProxy } = useSelector(
    (s: RootState) => s.user,
  );
  const { selectedSeriesInfo, loading, error } = useSelector(
    (s: RootState) => s.iptv,
  );

  const [watchProgress, setWatchProgress] = useState<
    Record<string, WatchProgress>
  >({});
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [seasonEpisodes, setSeasonEpisodes] = useState<SeasonEpisode[]>([]);

  const xtreamYear = baseInfo?.releaseDate
    ? String(baseInfo.releaseDate).substring(0, 4)
    : undefined;
  const { media: tmdbMatch } = useTmdbMatch({
    title: seriesName,
    year: xtreamYear ? parseInt(xtreamYear, 10) : undefined,
    type: 'series',
  });
  const { details: tmdbDetails } = useTmdbDetails({
    id: tmdbMatch?.id,
    type: 'series',
    enabled: Boolean(tmdbMatch?.id),
  });

  useEffect(() => {
    navigation.setOptions({ title: seriesName });
    dispatch(
      fetchSeriesInfo({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        seriesId,
        useProxy,
      }),
    );
  }, [seriesId, username, password, serverDomain, serverPort, useProxy]);

  const info = selectedSeriesInfo?.info ?? baseInfo ?? ({} as any);
  const episodes =
    selectedSeriesInfo?.episodes ?? ({} as Record<string, any[]>);
  const seasons = Object.keys(episodes);
  const multiSeason = seasons.length > 1;

  useEffect(() => {
    if (seasons.length && !selectedSeason) setSelectedSeason(seasons[0]);
  }, [seasons]);

  useEffect(() => {
    let cancelled = false;

    const loadSeasonEpisodes = async () => {
      if (!tmdbMatch?.id || !selectedSeason) {
        setSeasonEpisodes([]);
        return;
      }

      const seasonNumber = parseInt(selectedSeason, 10);
      if (Number.isNaN(seasonNumber)) {
        setSeasonEpisodes([]);
        return;
      }

      const episodes = await getSeasonEpisodes(tmdbMatch.id, seasonNumber);
      if (!cancelled) {
        setSeasonEpisodes(episodes ?? []);
      }
    };

    loadSeasonEpisodes();

    return () => {
      cancelled = true;
    };
  }, [tmdbMatch?.id, selectedSeason]);

  const currentEpisodes = useMemo(
    () => (selectedSeason ? episodes[selectedSeason] || [] : []),
    [selectedSeason, episodes],
  );

  const loadProgress = useCallback(async () => {
    if (seriesId && selectedSeason && episodes[selectedSeason]) {
      const progressMap: Record<string, WatchProgress> = {};
      for (const episode of episodes[selectedSeason]) {
        const progress = await storage.getWatchProgress(
          seriesId,
          false,
          seriesId,
          episode.id,
        );
        if (progress) {
          progressMap[episode.id] = progress;
        }
      }
      setWatchProgress(progressMap);
    }
  }, [seriesId, selectedSeason, episodes]);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [loadProgress]),
  );

  /* Data helpers */
  const xtreamHeroImg = info.backdrop_path?.[0] || info.cover;
  const heroImg =
    (xtreamHeroImg ? proxyStreamUrl(xtreamHeroImg, useProxy) : null) ||
    tmdbDetails?.backdrop ||
    tmdbMatch?.backdrop ||
    null;

  const posterImg =
    (info.cover ? proxyStreamUrl(info.cover, useProxy) : null) ||
    tmdbDetails?.poster ||
    tmdbMatch?.poster ||
    null;

  const xtreamRatingRaw = parseFloat(info.rating_5based || info.rating);
  const ratingValue =
    (!Number.isNaN(xtreamRatingRaw) && xtreamRatingRaw > 0
      ? xtreamRatingRaw
      : null) ??
    tmdbDetails?.rating ??
    tmdbMatch?.rating ??
    null;
  const rating =
    ratingValue != null ? ratingValue.toFixed(1) : null;

  const year =
    info.releaseDate?.substring(0, 4) ||
    info.year ||
    tmdbDetails?.releaseDate?.substring(0, 4) ||
    tmdbMatch?.releaseDate?.substring(0, 4) ||
    '';

  const plot =
    info.plot || tmdbDetails?.overview || tmdbMatch?.overview || '';

  const xtreamGenres: string[] = info.genre
    ? String(info.genre)
        .split(/[,/|]/)
        .map((g: string) => g.trim())
        .filter(Boolean)
    : [];
  const genres =
    xtreamGenres.length > 0 ? xtreamGenres : tmdbDetails?.genres ?? [];

  const xtreamCastArr: string[] = info.cast
    ? String(info.cast)
        .split(',')
        .map((n: string) => n.trim())
        .filter(Boolean)
    : [];
  const castMembers: CastMember[] =
    tmdbDetails?.cast?.length
      ? tmdbDetails.cast
      : xtreamCastArr.map((name, index) => ({
          id: String(index),
          name,
        }));

  const getEpisodeStill = (ep: any, index: number): string | null => {
    const episodeNumber = ep.episode_num ?? ep.episode ?? index + 1;
    const tmdbEpisode = seasonEpisodes.find(
      item => item.episodeNumber === Number(episodeNumber),
    );
    if (tmdbEpisode?.still) {
      return tmdbEpisode.still;
    }
    if (ep.info?.movie_image) {
      return proxyStreamUrl(ep.info.movie_image, useProxy);
    }
    if (heroImg) {
      return heroImg;
    }
    return null;
  };

  const getEpisodeSynopsis = (ep: any, index: number): string => {
    const episodeNumber = ep.episode_num ?? ep.episode ?? index + 1;
    const tmdbEpisode = seasonEpisodes.find(
      item => item.episodeNumber === Number(episodeNumber),
    );
    return ep.info?.plot || tmdbEpisode?.overview || '';
  };

  const playEpisode = (ep: any, index: number) => {
    if (!ep) return;
    const originalUrl = buildSeriesStreamUrl({
      domain: serverDomain,
      port: serverPort,
      username,
      password,
      streamId: ep.id,
      extension: ep.container_extension || 'mp4',
    });
    const url = proxyStreamUrl(originalUrl, useProxy);

    navigation.navigate('VideoPlayer', {
      streamUrl: url,
      isLive: false,
      title: ep.title,
      seriesId: seriesId,
      episodeId: ep.id,
      episodeList: currentEpisodes,
      currentEpisodeIndex: index,
      continueTime: watchProgress[ep.id] || 0,
      thumbnail: info.backdrop_path?.[0] || info.cover,
    });
  };

  /* Loading / error states */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <FontAwesome5
          name="exclamation-circle"
          size={36}
          color={colors.danger}
        />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const playLabel = `Play · S${selectedSeason || 1} E1`;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {heroImg ? (
            <FastImage
              source={{ uri: heroImg }}
              style={StyleSheet.absoluteFill}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(7,11,21,0.6)', colors.bg]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* top buttons */}
          <View style={[styles.heroTopRow, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.glassBtn}
              activeOpacity={0.8}
              onPress={() => navigation.goBack()}
            >
              <FontAwesome5 name="chevron-left" size={17} color={colors.fg} />
            </TouchableOpacity>
          </View>

          {/* poster + title */}
          <View style={styles.heroBottom}>
            <View style={styles.poster}>
              {posterImg ? (
                <FastImage
                  source={{ uri: posterImg }}
                  style={StyleSheet.absoluteFill}
                  resizeMode={FastImage.resizeMode.cover}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}>
                  <FontAwesome5 name="tv" size={24} color={colors.fgSubtle} />
                </View>
              )}
            </View>

            <View style={styles.heroTextBlock}>
              <Text style={styles.eyebrow}>SERIES</Text>
              <Text style={styles.title} numberOfLines={2}>
                {info.name || seriesName}
              </Text>
              <View style={styles.metaRow}>
                {rating != null && (
                  <View style={styles.metaItem}>
                    <FontAwesome5
                      name="star"
                      size={11}
                      color={colors.warning}
                      solid
                    />
                    <Text style={styles.metaStrong}>{rating}</Text>
                  </View>
                )}
                {!!year && (
                  <>
                    {rating != null && <Text style={styles.metaDot}>·</Text>}
                    <Text style={styles.metaText}>{year}</Text>
                  </>
                )}
                {seasons.length > 0 && (
                  <>
                    {(rating != null || !!year) && (
                      <Text style={styles.metaDot}>·</Text>
                    )}
                    <Text style={styles.metaText}>
                      {seasons.length} season{seasons.length === 1 ? '' : 's'}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── Genre chips ── */}
        {genres.length > 0 && (
          <View style={styles.genreRow}>
            {genres.map((g, i) => (
              <View key={`${g}-${i}`} style={styles.genreChip}>
                <Text style={styles.genreText}>{g}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Primary actions ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.playButton}
            activeOpacity={0.85}
            onPress={() => playEpisode(currentEpisodes[0], 0)}
          >
            <FontAwesome5 name="play" size={14} color={colors.scene} solid />
            <Text style={styles.playText}>{playLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Description ── */}
        {!!plot && (
          <View style={styles.descBlock}>
            <Text
              style={styles.descText}
              numberOfLines={expanded ? undefined : 3}
            >
              {plot}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpanded(e => !e)}
            >
              <Text style={styles.readMore}>
                {expanded ? 'Show less' : 'Read more'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Cast ── */}
        {castMembers.length > 0 && (
          <View style={styles.castBlock}>
            <Text style={styles.sectionEyebrow}>CAST</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.castScroll}
            >
              {castMembers.map(member => (
                <View key={member.id} style={styles.castItem}>
                  <View style={styles.castAvatar}>
                    {member.profile ? (
                      <FastImage
                        source={{ uri: member.profile }}
                        style={StyleSheet.absoluteFill}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    ) : (
                      <Text style={styles.castInitials}>
                        {initials(member.name)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.castName} numberOfLines={2}>
                    {member.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Episodes ── */}
        <View style={styles.episodesBlock}>
          <View style={styles.episodesHeader}>
            <Text style={styles.episodesTitle}>Episodes</Text>

            {multiSeason ? (
              <View style={styles.seasonWrap}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSeasonOpen(o => !o)}
                  style={[
                    styles.seasonBtn,
                    seasonOpen && { borderColor: `${ACCENT}66` },
                  ]}
                >
                  <Text style={styles.seasonBtnText}>
                    Season {selectedSeason}
                  </Text>
                  <FontAwesome5
                    name={seasonOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={colors.fgMuted}
                  />
                </TouchableOpacity>

                {seasonOpen && (
                  <>
                    <Pressable
                      style={styles.seasonScrim}
                      onPress={() => setSeasonOpen(false)}
                    />
                    <View style={styles.seasonPanel}>
                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ maxHeight: 260 }}
                      >
                        {seasons.map(num => {
                          const on = num === selectedSeason;
                          return (
                            <TouchableOpacity
                              key={num}
                              activeOpacity={0.7}
                              onPress={() => {
                                setSelectedSeason(num);
                                setSeasonOpen(false);
                              }}
                              style={[
                                styles.seasonRow,
                                on && { backgroundColor: `${ACCENT}1f` },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.seasonRowText,
                                  on && { color: colors.fg },
                                ]}
                              >
                                Season {num}
                              </Text>
                              <Text style={styles.seasonRowCount}>
                                {episodes[num]?.length || 0} ep
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.episodesCount}>
                {currentEpisodes.length} episodes
              </Text>
            )}
          </View>

          <View style={styles.episodeList}>
            {currentEpisodes.map((ep, index) => {
              const p = watchProgress[ep.id];
              const pct =
                p && p.totalDuration
                  ? Math.max(0, Math.min(100, (p.progress / p.totalDuration) * 100))
                  : 0;
              const epImg = getEpisodeStill(ep, index);
              const synopsis = getEpisodeSynopsis(ep, index);
              const rawDuration = ep.info?.duration;
              // Hide null/0/"00:00:00" durations — only show if it has a non-zero digit
              const duration =
                rawDuration && /[1-9]/.test(String(rawDuration))
                  ? rawDuration
                  : null;
              const remaining = formatRemaining(p);

              return (
                <TouchableOpacity
                  key={ep.id}
                  style={styles.episodeRow}
                  activeOpacity={0.8}
                  onPress={() => playEpisode(ep, index)}
                >
                  <View style={styles.epThumb}>
                    {epImg ? (
                      <FastImage
                        source={{ uri: epImg }}
                        style={StyleSheet.absoluteFill}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    ) : (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          styles.heroPlaceholder,
                        ]}
                      />
                    )}
                    <View style={styles.epPlay}>
                      <FontAwesome5 name="play" size={11} color={colors.fg} solid />
                    </View>
                    {pct > 0 && (
                      <View style={styles.epProgressTrack}>
                        <View
                          style={[styles.epProgressFill, { width: `${pct}%` }]}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.epBody}>
                    <Text style={styles.epTitle}>{ep.title}</Text>
                    {!!duration && (
                      <Text style={styles.epDuration}>{duration}</Text>
                    )}
                    {!!synopsis && (
                      <Text style={styles.epSynopsis} numberOfLines={2}>
                        {synopsis}
                      </Text>
                    )}
                    {!!remaining && (
                      <Text style={styles.epContinue}>{remaining}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default SeriesDetailScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
  },
  errorText: {
    fontFamily: FONT,
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },

  // hero
  hero: {
    width: '100%',
    aspectRatio: 16 / 11,
    backgroundColor: colors.surface,
  },
  heroPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTopRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(8,11,22,0.5)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  poster: {
    width: 92,
    aspectRatio: 2 / 3,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 2,
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.8,
    color: ACCENT,
    marginBottom: 6,
  },
  title: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '700',
    color: colors.fg,
    lineHeight: 28,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaStrong: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '600',
    color: colors.fg,
  },
  metaText: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.fgMuted,
  },
  metaDot: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.fgSubtle,
  },

  // genre chips
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  genreChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    color: colors.fgMuted,
  },

  // actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  playButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.fg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '700',
    color: colors.scene,
  },

  // description
  descBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  descText: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 22,
    color: colors.fgMuted,
  },
  readMore: {
    marginTop: 6,
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '600',
    color: ACCENT,
  },

  // cast
  castBlock: {
    marginTop: 22,
  },
  sectionEyebrow: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.7,
    color: colors.fgSubtle,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  castScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  castItem: {
    width: 64,
    alignItems: 'center',
  },
  castAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  castInitials: {
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: '600',
    color: colors.fg,
  },
  castName: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.fg,
    textAlign: 'center',
    lineHeight: 15,
  },

  // episodes
  episodesBlock: {
    marginTop: 26,
    paddingHorizontal: 20,
  },
  episodesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    zIndex: 30,
  },
  episodesTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '600',
    color: colors.fg,
  },
  episodesCount: {
    fontFamily: MONO,
    fontSize: 12,
    color: colors.fgSubtle,
  },
  seasonWrap: {
    position: 'relative',
    zIndex: 30,
  },
  seasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seasonBtnText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '600',
    color: colors.fg,
  },
  seasonScrim: {
    position: 'absolute',
    top: 40,
    right: -20,
    width: width,
    height: 2000,
    zIndex: 1,
  },
  seasonPanel: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 160,
    zIndex: 2,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 9,
  },
  seasonRowText: {
    fontFamily: FONT,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.fgMuted,
  },
  seasonRowCount: {
    fontFamily: MONO,
    fontSize: 11,
    color: colors.fgSubtle,
  },
  episodeList: {
    gap: 14,
  },
  episodeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  epThumb: {
    width: THUMB_W,
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  epPlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  epProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  epBody: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  epTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: colors.fg,
    lineHeight: 18,
  },
  epDuration: {
    marginTop: 3,
    fontFamily: MONO,
    fontSize: 11,
    color: colors.fgSubtle,
  },
  epSynopsis: {
    marginTop: 4,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 17,
    color: colors.fgMuted,
  },
  epContinue: {
    marginTop: 6,
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    color: ACCENT,
  },
});
