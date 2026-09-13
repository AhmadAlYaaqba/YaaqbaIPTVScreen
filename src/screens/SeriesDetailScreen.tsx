import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  type ListRenderItem,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';

import type { RootScreenProps } from '../navigation/types';
import { RootState } from '../store';
import {
  getXtreamErrorMessage,
  useXtreamSeriesDetails,
} from '../services/xtream/xtreamQueries';
import type {
  XtreamEpisode,
  XtreamSession,
} from '../services/xtream/xtreamService';
import { storage, type WatchProgress } from '../utils/storage';
import { proxyStreamUrl } from '../utils/proxy';
import {
  getMediaDurationSeconds,
  parseRuntimeMinutes,
} from '../utils/playbackTime';
import {
  useTmdbDetails,
  useTmdbMatch,
  useTmdbSeasonEpisodes,
} from '../hooks/useTmdbMatch';
import { CastMember } from '../types/media';
import { colors, sectionAccents, radii } from '../theme/colors';
import { getTenPointRating } from '../utils/rating';
import { CatalogStatus } from '../components/catalog/CatalogStates';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import CachedRemoteImage from '../components/CachedRemoteImage';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });
const ACCENT = sectionAccents.series; // cyan
const REFRESH_COLORS = [ACCENT];

type Props = RootScreenProps<'SeriesDetail'>;
export type SeriesDetailRouteProp = Props['route'];
export type SeriesDetailNavProp = Props['navigation'];

const { width } = Dimensions.get('window');
const THUMB_W = 124;

interface EpisodeRowData {
  key: string;
  imageContentId: string;
  index: number;
  title: string;
  image: string | null;
  duration: string | null;
  synopsis: string;
  remaining: string | null;
  progressPercent: number;
}

interface EpisodeRowProps extends Omit<EpisodeRowData, 'key'> {
  onPressEpisode: (index: number) => void;
}

const SeriesDetailSkeleton = React.memo(() => (
  <View style={styles.skeletonRoot}>
    <View style={styles.skeletonHero} />
    <View style={styles.skeletonBody}>
      <View style={[styles.skeletonLine, styles.skeletonTitle]} />
      <View style={[styles.skeletonLine, styles.skeletonMeta]} />
      <View style={styles.skeletonButton} />
      <View style={[styles.skeletonLine, styles.skeletonCopy]} />
      <View style={[styles.skeletonLine, styles.skeletonCopyShort]} />
      <View style={styles.skeletonEpisode} />
      <View style={styles.skeletonEpisode} />
    </View>
  </View>
));

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

const CastListItem = React.memo(
  ({
    memberId,
    name,
    profile,
    playlistId,
  }: Pick<CastMember, 'name' | 'profile'> & {
    memberId: string;
    playlistId: string | null;
  }) => (
    <View style={styles.castItem}>
      <CachedRemoteImage
        uri={profile}
        playlistId={playlistId}
        contentId={memberId}
        variant="cast"
        style={styles.castAvatar}
        displayWidth={60}
        displayHeight={60}
        fallback={
          <View style={styles.castAvatarFallback}>
            <Text style={styles.castInitials}>{initials(name)}</Text>
          </View>
        }
      />
      <Text style={styles.castName} numberOfLines={2}>
        {name}
      </Text>
    </View>
  ),
);

const EpisodeListItem = React.memo(
  ({
    index,
    imageContentId,
    title,
    image,
    duration,
    synopsis,
    remaining,
    progressPercent,
    onPressEpisode,
    playlistId,
  }: EpisodeRowProps & { playlistId: string | null }) => {
    const handlePress = useCallback(() => {
      onPressEpisode(index);
    }, [index, onPressEpisode]);

    return (
      <TouchableOpacity
        style={styles.episodeRow}
        activeOpacity={0.8}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={[
          title,
          duration ? `duration ${duration}` : null,
          remaining,
        ]
          .filter(Boolean)
          .join(', ')}>
        <View style={styles.epThumb}>
          <CachedRemoteImage
            uri={image}
            playlistId={playlistId}
            contentId={imageContentId}
            variant="episode-still"
            style={StyleSheet.absoluteFill}
            displayWidth={THUMB_W}
            displayHeight={(THUMB_W * 9) / 16}
            fallback={
              <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} />
            }
          />
          <View style={styles.epPlay}>
            <FontAwesome5 name="play" size={11} color={colors.fg} solid />
          </View>
          {progressPercent > 0 && (
            <View style={styles.epProgressTrack}>
              <View
                style={[
                  styles.epProgressFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
          )}
        </View>

        <View style={styles.epBody}>
          <Text style={styles.epTitle}>{title}</Text>
          {!!duration && <Text style={styles.epDuration}>{duration}</Text>}
          {!!synopsis && (
            <Text style={styles.epSynopsis} numberOfLines={2}>
              {synopsis}
            </Text>
          )}
          {!!remaining && <Text style={styles.epContinue}>{remaining}</Text>}
        </View>
      </TouchableOpacity>
    );
  },
);

const SeriesDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { seriesId, seriesName, baseInfo } = route.params;
  const insets = useSafeAreaInsets();

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
  const seriesDetailsQuery = useXtreamSeriesDetails(session, seriesId);
  const selectedSeriesInfo = seriesDetailsQuery.data;
  const loading = seriesDetailsQuery.isPending;
  const error = getXtreamErrorMessage(seriesDetailsQuery.error);
  const { isOffline } = useNetworkStatus();

  const [watchProgress, setWatchProgress] = useState<
    Record<string, WatchProgress>
  >({});
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const episodeListRef = useRef<FlatList<EpisodeRowData>>(null);
  const shouldRestoreEpisodeSectionRef = useRef(false);

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
  }, [navigation, seriesName]);

  const info = selectedSeriesInfo?.info ?? baseInfo ?? ({} as any);
  const episodes = useMemo(
    () => selectedSeriesInfo?.episodes ?? ({} as Record<string, any[]>),
    [selectedSeriesInfo?.episodes],
  );
  const seasons = useMemo(() => Object.keys(episodes), [episodes]);
  const multiSeason = seasons.length > 1;

  useEffect(() => {
    if (
      seasons.length &&
      (!selectedSeason || !seasons.includes(selectedSeason))
    ) {
      setSelectedSeason(seasons[0]);
    } else if (!seasons.length && selectedSeason) {
      setSelectedSeason(null);
    }
  }, [seasons, selectedSeason]);

  const selectedSeasonNumber = selectedSeason
    ? parseInt(selectedSeason, 10)
    : null;
  const { episodes: seasonEpisodes } = useTmdbSeasonEpisodes({
    tvId: tmdbMatch?.id,
    season:
      selectedSeasonNumber != null && !Number.isNaN(selectedSeasonNumber)
        ? selectedSeasonNumber
        : null,
    enabled: Boolean(tmdbMatch?.id),
  });

  const currentEpisodes = useMemo(
    () => (selectedSeason ? episodes[selectedSeason] || [] : []),
    [selectedSeason, episodes],
  );

  useFocusEffect(
    useCallback(() => {
      if (!playlistId) {
        setWatchProgress({});
        return;
      }
      let active = true;
      storage.getAllProgress(false).then(allProgress => {
        if (!active) return;
        const prefix = `${seriesId}_`;
        const progressForSeries: Record<string, WatchProgress> = {};
        Object.entries(allProgress).forEach(([key, progress]) => {
          if (key.startsWith(prefix)) {
            progressForSeries[key.slice(prefix.length)] = progress;
          }
        });
        setWatchProgress(progressForSeries);
      });
      return () => {
        active = false;
      };
    }, [playlistId, seriesId]),
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

  const ratingValue =
    getTenPointRating(info.rating, info.rating_5based) ??
    tmdbDetails?.rating ??
    tmdbMatch?.rating ??
    null;
  const rating = ratingValue != null ? ratingValue.toFixed(1) : null;

  const year =
    info.releaseDate?.substring(0, 4) ||
    info.year ||
    tmdbDetails?.releaseDate?.substring(0, 4) ||
    tmdbMatch?.releaseDate?.substring(0, 4) ||
    '';

  const plot = info.plot || tmdbDetails?.overview || tmdbMatch?.overview || '';

  const xtreamGenres: string[] = info.genre
    ? String(info.genre)
        .split(/[,/|]/)
        .map((g: string) => g.trim())
        .filter(Boolean)
    : [];
  const genres =
    xtreamGenres.length > 0 ? xtreamGenres : tmdbDetails?.genres ?? [];

  const castMembers = useMemo<CastMember[]>(() => {
    if (tmdbDetails?.cast?.length) {
      return tmdbDetails.cast;
    }
    return info.cast
      ? String(info.cast)
          .split(',')
          .map((name: string, index: number) => ({
            id: String(index),
            name: name.trim(),
          }))
          .filter(member => Boolean(member.name))
      : [];
  }, [info.cast, tmdbDetails?.cast]);

  const episodeRows = useMemo<EpisodeRowData[]>(() => {
    const tmdbByEpisodeNumber = new Map(
      seasonEpisodes.map(episode => [episode.episodeNumber, episode]),
    );

    return currentEpisodes.map((episode: XtreamEpisode, index: number) => {
      const episodeNumber = Number(
        episode.episode_num ?? episode.episode ?? index + 1,
      );
      const tmdbEpisode = tmdbByEpisodeNumber.get(episodeNumber);
      const progress = watchProgress[String(episode.id)];
      const rawDuration = episode.info?.duration;
      const duration =
        rawDuration && /[1-9]/.test(String(rawDuration))
          ? String(rawDuration)
          : null;
      const image = tmdbEpisode?.still
        ? tmdbEpisode.still
        : episode.info?.movie_image
        ? proxyStreamUrl(String(episode.info.movie_image), useProxy)
        : heroImg;
      const progressPercent =
        progress?.totalDuration && progress.totalDuration > 0
          ? Math.max(
              0,
              Math.min(100, (progress.progress / progress.totalDuration) * 100),
            )
          : 0;

      return {
        key: `${selectedSeason ?? 'season'}:${String(episode.id)}`,
        imageContentId: `${seriesId}:${selectedSeason ?? 'season'}:${String(
          episode.id,
        )}`,
        index,
        title: episode.title || `Episode ${index + 1}`,
        image: image || null,
        duration,
        synopsis: episode.info?.plot || tmdbEpisode?.overview || '',
        remaining: formatRemaining(progress),
        progressPercent,
      };
    });
  }, [
    currentEpisodes,
    heroImg,
    seasonEpisodes,
    selectedSeason,
    seriesId,
    useProxy,
    watchProgress,
  ]);

  const playbackThumbnail = info.backdrop_path?.[0] || info.cover;
  const fallbackRuntimeMinutes =
    parseRuntimeMinutes(info.episode_run_time) ?? tmdbDetails?.runtime;

  const playEpisodeAtIndex = useCallback(
    (index: number) => {
      const ep = currentEpisodes[index];
      if (!ep) return;
      const savedProgress = watchProgress[String(ep.id)];

      navigation.navigate('VideoPlayer', {
        request: {
          kind: 'episode',
          streamId: String(ep.id),
          extension: ep.container_extension || 'mp4',
          title: ep.title || 'Episode',
          expectedDuration: getMediaDurationSeconds(ep, fallbackRuntimeMinutes),
          seriesId,
          episodeList: currentEpisodes,
          currentEpisodeIndex: index,
          resume: savedProgress
            ? {
                progress: savedProgress.progress,
                totalDuration: savedProgress.totalDuration,
              }
            : undefined,
          thumbnail: playbackThumbnail,
        },
      });
    },
    [
      currentEpisodes,
      fallbackRuntimeMinutes,
      navigation,
      playbackThumbnail,
      seriesId,
      watchProgress,
    ],
  );

  const handlePlayFirstEpisode = useCallback(() => {
    playEpisodeAtIndex(0);
  }, [playEpisodeAtIndex]);

  const handleSeasonSelect = useCallback((season: string) => {
    shouldRestoreEpisodeSectionRef.current = true;
    setSelectedSeason(season);
    setSeasonOpen(false);
  }, []);

  useEffect(() => {
    if (!shouldRestoreEpisodeSectionRef.current) {
      return;
    }
    shouldRestoreEpisodeSectionRef.current = false;
    const frame = requestAnimationFrame(() => {
      if (episodeRows.length > 0) {
        episodeListRef.current?.scrollToIndex({
          index: 0,
          animated: true,
          viewPosition: 0,
        });
      } else {
        episodeListRef.current?.scrollToEnd({ animated: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [episodeRows]);

  const renderCastItem: ListRenderItem<CastMember> = useCallback(
    ({ item }) => (
      <CastListItem
        memberId={item.id}
        name={item.name}
        profile={item.profile}
        playlistId={playlistId}
      />
    ),
    [playlistId],
  );
  const castKeyExtractor = useCallback((item: CastMember) => item.id, []);

  const renderEpisode: ListRenderItem<EpisodeRowData> = useCallback(
    ({ item }) => (
      <EpisodeListItem
        key={item.key}
        index={item.index}
        imageContentId={item.imageContentId}
        title={item.title}
        image={item.image}
        duration={item.duration}
        synopsis={item.synopsis}
        remaining={item.remaining}
        progressPercent={item.progressPercent}
        playlistId={playlistId}
        onPressEpisode={playEpisodeAtIndex}
      />
    ),
    [playEpisodeAtIndex, playlistId],
  );
  const episodeKeyExtractor = useCallback(
    (item: EpisodeRowData) => item.key,
    [],
  );
  const handleScrollToEpisodeFailed = useCallback(() => {
    episodeListRef.current?.scrollToEnd({ animated: false });
    requestAnimationFrame(() => {
      episodeListRef.current?.scrollToIndex({
        index: 0,
        animated: true,
        viewPosition: 0,
      });
    });
  }, []);

  const refetchSeriesDetails = seriesDetailsQuery.refetch;
  const handleRefresh = useCallback(() => {
    refetchSeriesDetails();
  }, [refetchSeriesDetails]);
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  /* Loading / error states */
  if (loading && !selectedSeriesInfo) {
    return (
      <View style={styles.root}>
        <SeriesDetailSkeleton />
      </View>
    );
  }
  if (!selectedSeriesInfo) {
    return (
      <View style={styles.root}>
        <CatalogStatus
          kind={isOffline ? 'offline' : error ? 'error' : 'empty'}
          title={
            isOffline
              ? 'Series unavailable offline'
              : error
              ? 'Could not load series'
              : 'Series unavailable'
          }
          message={
            isOffline
              ? 'Reconnect and retry to load details and episodes.'
              : error || 'No details or episodes were returned for this series.'
          }
          accent={ACCENT}
          onRetry={handleRefresh}
        />
      </View>
    );
  }

  const playLabel = `Play · S${selectedSeason || 1} E1`;

  return (
    <View style={styles.root}>
      <FlatList
        ref={episodeListRef}
        data={episodeRows}
        renderItem={renderEpisode}
        keyExtractor={episodeKeyExtractor}
        onScrollToIndexFailed={handleScrollToEpisodeFailed}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={seriesDetailsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
            colors={REFRESH_COLORS}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Hero ── */}
            <View style={styles.hero}>
              <CachedRemoteImage
                uri={heroImg}
                playlistId={playlistId}
                contentId={seriesId}
                variant="backdrop"
                style={StyleSheet.absoluteFill}
                priority="high"
                displayWidth={width}
                displayHeight={(width * 11) / 16}
                fallback={
                  <View
                    style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}
                  />
                }
              />
              <LinearGradient
                colors={['transparent', 'rgba(7,11,21,0.6)', colors.bg]}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              <View style={[styles.heroTopRow, { top: insets.top + 8 }]}>
                <TouchableOpacity
                  style={styles.glassBtn}
                  activeOpacity={0.8}
                  onPress={handleGoBack}
                  accessibilityRole="button"
                  accessibilityLabel="Back to series">
                  <FontAwesome5
                    name="chevron-left"
                    size={17}
                    color={colors.fg}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.heroBottom}>
                <View style={styles.poster}>
                  <CachedRemoteImage
                    uri={posterImg}
                    playlistId={playlistId}
                    contentId={seriesId}
                    variant="poster"
                    style={StyleSheet.absoluteFill}
                    priority="high"
                    displayWidth={92}
                    displayHeight={138}
                    fallback={
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          styles.heroPlaceholder,
                        ]}>
                        <FontAwesome5
                          name="tv"
                          size={24}
                          color={colors.fgSubtle}
                        />
                      </View>
                    }
                  />
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
                        {rating != null && (
                          <Text style={styles.metaDot}>·</Text>
                        )}
                        <Text style={styles.metaText}>{year}</Text>
                      </>
                    )}
                    {seasons.length > 0 && (
                      <>
                        {(rating != null || !!year) && (
                          <Text style={styles.metaDot}>·</Text>
                        )}
                        <Text style={styles.metaText}>
                          {seasons.length} season
                          {seasons.length === 1 ? '' : 's'}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {genres.length > 0 && (
              <View style={styles.genreRow}>
                {genres.map((genre, index) => (
                  <View key={`${genre}-${index}`} style={styles.genreChip}>
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}

            {currentEpisodes.length > 0 && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.playButton}
                  activeOpacity={0.85}
                  onPress={handlePlayFirstEpisode}
                  accessibilityRole="button"
                  accessibilityLabel={playLabel}>
                  <FontAwesome5
                    name="play"
                    size={14}
                    color={colors.scene}
                    solid
                  />
                  <Text style={styles.playText}>{playLabel}</Text>
                </TouchableOpacity>
              </View>
            )}

            {!!plot && (
              <View style={styles.descBlock}>
                <Text
                  style={styles.descText}
                  numberOfLines={expanded ? undefined : 3}>
                  {plot}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpanded(value => !value)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    expanded ? 'Show less' : 'Read full description'
                  }
                  accessibilityState={{ expanded }}>
                  <Text style={styles.readMore}>
                    {expanded ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {castMembers.length > 0 && (
              <View style={styles.castBlock}>
                <Text style={styles.sectionEyebrow}>CAST</Text>
                <FlatList
                  horizontal
                  data={castMembers}
                  renderItem={renderCastItem}
                  keyExtractor={castKeyExtractor}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.castScroll}
                  initialNumToRender={6}
                  maxToRenderPerBatch={8}
                  windowSize={5}
                />
              </View>
            )}

            <View style={styles.episodesBlock}>
              <View style={styles.episodesHeader}>
                <Text style={styles.episodesTitle}>Episodes</Text>

                {multiSeason ? (
                  <View style={styles.seasonWrap}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setSeasonOpen(open => !open)}
                      style={[
                        styles.seasonBtn,
                        seasonOpen && { borderColor: `${ACCENT}66` },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Season ${selectedSeason}`}
                      accessibilityState={{ expanded: seasonOpen }}>
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
                          accessible={false}
                        />
                        <View style={styles.seasonPanel}>
                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={styles.seasonScroll}>
                            {seasons.map(num => {
                              const selected = num === selectedSeason;
                              return (
                                <TouchableOpacity
                                  key={num}
                                  activeOpacity={0.7}
                                  onPress={() => handleSeasonSelect(num)}
                                  style={[
                                    styles.seasonRow,
                                    selected && {
                                      backgroundColor: `${ACCENT}1f`,
                                    },
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Season ${num}, ${
                                    episodes[num]?.length || 0
                                  } episodes`}
                                  accessibilityState={{ selected }}>
                                  <Text
                                    style={[
                                      styles.seasonRowText,
                                      selected && { color: colors.fg },
                                    ]}>
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
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyEpisodes}>
            <CatalogStatus
              kind="empty"
              title="No episodes available"
              message="This playlist did not return episodes for the selected season."
              accent={ACCENT}
              onRetry={handleRefresh}
            />
          </View>
        }
      />
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
  skeletonRoot: {
    flex: 1,
  },
  skeletonHero: {
    width: '100%',
    aspectRatio: 16 / 11,
    backgroundColor: colors.surface,
  },
  skeletonBody: {
    padding: 20,
    gap: 14,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.glass,
  },
  skeletonTitle: {
    width: '68%',
    height: 24,
  },
  skeletonMeta: {
    width: '42%',
  },
  skeletonButton: {
    width: 150,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: `${ACCENT}18`,
  },
  skeletonCopy: {
    width: '100%',
  },
  skeletonCopyShort: {
    width: '76%',
  },
  skeletonEpisode: {
    height: 86,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
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
  castAvatarFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
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
    minHeight: 44,
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
  seasonScroll: {
    maxHeight: 260,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 11,
    minHeight: 44,
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
  episodeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 14,
  },
  emptyEpisodes: {
    paddingHorizontal: 20,
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
