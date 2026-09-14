import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
  Pattern,
  Path,
  Mask,
} from 'react-native-svg';
import AppIcon from '../components/AppIcon';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';

import type { TabParamList, TabScreenProps } from '../navigation/types';
import { RootState } from '../store';
import { storage, type LatestWatched } from '../utils/storage';
import { colors, sectionAccents, radii, gradients } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import CachedRemoteImage from '../components/CachedRemoteImage';
import FocusablePressable from '../tv/FocusablePressable';
import { useXtreamAccountInfo } from '../services/xtream/xtreamQueries';
import type { XtreamSession } from '../services/xtream/xtreamService';
import { historyEntryToPlaybackRequest } from '../utils/historyPlayback';
import {
  createSubscriptionSummary,
  type SubscriptionSummary,
} from '../utils/subscription';

type HomeScreenProps = TabScreenProps<'Home'>;

const IS_TV = Platform.isTV;
const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

// ─────────────────────────────────────────────────────────────
// Faint grid backdrop — fades out toward the edges
// ─────────────────────────────────────────────────────────────
function GridBg() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="grid" width={32} height={32} patternUnits="userSpaceOnUse">
          <Path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        </Pattern>
        <SvgRadialGradient id="grid-fade" cx="50%" cy="20%" r="60%">
          <Stop offset="30%" stopColor="#fff" stopOpacity={1} />
          <Stop offset="75%" stopColor="#fff" stopOpacity={0} />
        </SvgRadialGradient>
        <Mask id="grid-mask">
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#grid-fade)" />
        </Mask>
      </Defs>
      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="url(#grid)"
        mask="url(#grid-mask)"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Header — gradient avatar, greeting, settings
// ─────────────────────────────────────────────────────────────
function Header({
  subId,
  onSettings,
}: {
  subId: string;
  onSettings: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {/* gradient avatar ring */}
        <LinearGradient
          colors={[colors.cyan, colors.indigo, colors.magenta]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.avatarRing}>
          <View style={styles.avatarInner}>
            <AppIcon name="user" size={18} color={colors.indigo} />
          </View>
        </LinearGradient>
        <View>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.subId} numberOfLines={1}>
            {subId}
          </Text>
        </View>
      </View>
      <FocusablePressable
        style={styles.settingsBtn}
        focusScale={1.12}
        onPress={onSettings}
        accessibilityRole="button"
        accessibilityLabel="Open settings">
        <AppIcon name="cog" size={17} color={colors.fgMuted} />
      </FocusablePressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Subscription card
// ─────────────────────────────────────────────────────────────
function SubscriptionCard({ sub }: { sub: SubscriptionSummary }) {
  const rawDays = sub.daysLeft;
  // Far-future expiry (panels often set ~year 2099 for non-expiring) reads as unlimited.
  const unlimited = rawDays != null && rawDays > 3650;
  const daysLeft = unlimited ? null : rawDays;
  const totalDays = sub.totalDays;
  const isTrial = sub.status === 'trial';
  const isWarning = daysLeft != null && daysLeft <= 7 && daysLeft >= 0;
  const accent = isTrial
    ? colors.cyan
    : isWarning
    ? colors.magenta
    : colors.indigo;
  const dot = isWarning
    ? colors.warning
    : isTrial
    ? colors.cyan
    : colors.success;
  const statusLabel = isTrial
    ? 'trial'
    : sub.status === 'expired'
    ? 'expired'
    : 'active';
  const plan = sub.plan;
  const pct =
    daysLeft == null
      ? 100
      : Math.max(0, Math.min(100, (daysLeft / totalDays) * 100));

  return (
    <View style={styles.subCard}>
      {/* base tint */}
      <LinearGradient
        colors={['rgba(139,123,255,0.08)', 'rgba(14,20,40,0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* accent halo — soft radial that fades before the edges */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgRadialGradient id="sub-halo" cx="100%" cy="0%" r="62%">
            <Stop
              offset="0%"
              stopColor={accent}
              stopOpacity={isWarning ? 0.3 : 0.2}
            />
            <Stop offset="72%" stopColor={accent} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sub-halo)" />
      </Svg>

      <View style={styles.subTopRow}>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: `${accent}1f`, borderColor: `${accent}55` },
          ]}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: dot, shadowColor: dot },
            ]}
          />
          <Text style={styles.statusText} numberOfLines={1}>
            {plan} · {statusLabel}
          </Text>
        </View>
        <View style={styles.viewOnly}>
          <AppIcon name="eye" size={11} color={colors.fgSubtle} />
          <Text style={styles.viewOnlyText}>View only</Text>
        </View>
      </View>

      <View style={styles.daysRow}>
        <Text style={styles.daysNumber}>
          {daysLeft == null ? '∞' : daysLeft}
        </Text>
        <Text style={styles.daysLabel}>days left</Text>
      </View>

      <View
        style={styles.progressTrack}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Subscription time remaining"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
        <LinearGradient
          colors={
            (isWarning
              ? gradients.progressWarning
              : gradients.progress) as unknown as string[]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${pct}%` }]}
        />
      </View>

      <View style={styles.subFooter}>
        <Text style={styles.subFooterText}>
          {unlimited ? 'No expiry date' : `Expires ${sub.expiresOn}`}
        </Text>
        <Text style={styles.subFooterText}>
          {unlimited ? 'Unlimited' : `${totalDays}d plan`}
        </Text>
      </View>

      {isWarning && (
        <View style={styles.warningBanner}>
          <AppIcon
            name="exclamation-triangle"
            size={12}
            color={colors.warning}
          />
          <Text style={styles.warningText}>
            Subscription ending soon — contact your provider to renew.
          </Text>
        </View>
      )}
    </View>
  );
}

const SubscriptionLoadingCard = React.memo(() => (
  <View
    style={styles.subCard}
    accessible
    accessibilityLabel="Loading subscription information">
    <View
      style={[styles.subscriptionSkeleton, styles.subscriptionSkeletonTag]}
    />
    <View
      style={[styles.subscriptionSkeleton, styles.subscriptionSkeletonValue]}
    />
    <View
      style={[styles.subscriptionSkeleton, styles.subscriptionSkeletonBar]}
    />
    <View
      style={[styles.subscriptionSkeleton, styles.subscriptionSkeletonMeta]}
    />
  </View>
));

const SubscriptionRetryCard = React.memo(
  ({ onRetry }: { onRetry: () => void }) => (
    <View style={styles.subCard}>
      <View style={styles.subscriptionErrorRow}>
        <AppIcon
          name="exclamation-circle"
          size={18}
          color={colors.warning}
        />
        <View style={styles.subscriptionErrorCopy}>
          <Text style={styles.subscriptionErrorTitle}>
            Subscription information unavailable
          </Text>
          <Text style={styles.subscriptionErrorMessage}>
            Check your connection and try again.
          </Text>
        </View>
      </View>
      <FocusablePressable
        style={styles.subscriptionRetryButton}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry subscription information">
        <AppIcon name="redo" size={12} color={colors.fg} />
        <Text style={styles.subscriptionRetryText}>Retry</Text>
      </FocusablePressable>
    </View>
  ),
);

// ─────────────────────────────────────────────────────────────
// Section tiles — Live / Movies / Series
// ─────────────────────────────────────────────────────────────
type SectionDef = {
  id: 'live' | 'movies' | 'series';
  title: string;
  accent: string;
  baseColor: string;
  corner: { cx: string; cy: string };
  renderIcon: (size: number, color: string) => React.ReactNode;
};

const SECTIONS: SectionDef[] = [
  {
    id: 'live',
    title: 'Live TV',
    accent: sectionAccents.live,
    baseColor: '#160a1c',
    corner: { cx: '2%', cy: '2%' },
    renderIcon: (size, color) => (
      <AppIcon name="broadcast-tower" size={size} color={color} />
    ),
  },
  {
    id: 'movies',
    title: 'Movies',
    accent: sectionAccents.movies,
    baseColor: '#0e1126',
    corner: { cx: '98%', cy: '2%' },
    renderIcon: (size, color) => (
      <AppIcon name="film" size={size} color={color} />
    ),
  },
  {
    id: 'series',
    title: 'Series',
    accent: sectionAccents.series,
    baseColor: '#08141f',
    corner: { cx: '2%', cy: '98%' },
    renderIcon: (size, color) => (
      <AppIcon name="tv" size={size} color={color} />
    ),
  },
];
const NAV_BY_SECTION: Record<SectionDef['id'], keyof TabParamList> = {
  live: 'LiveTV',
  movies: 'Movies',
  series: 'Series',
};

const SectionTile = React.memo(function SectionTile({
  s,
  onPress,
}: {
  s: SectionDef;
  onPress: (id: SectionDef['id']) => void;
}) {
  const handlePress = useCallback(() => onPress(s.id), [onPress, s.id]);
  return (
    <FocusablePressable
      onPress={handlePress}
      style={[styles.sectionTile, { borderColor: `${s.accent}30` }]}
      // Wide tiles: subtle scale so they don't spill over the TV rail.
      focusScale={1.02}
      // TV: land on Live TV first instead of the header settings button.
      hasTVPreferredFocus={IS_TV && s.id === 'live'}
      accessibilityRole="button"
      accessibilityLabel={`Open ${s.title}`}>
      {/* background: solid base + soft accent corner glow (radial, fades before edge) */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgRadialGradient
            id={`sec-${s.id}`}
            cx={s.corner.cx}
            cy={s.corner.cy}
            r="80%">
            <Stop offset="0%" stopColor={s.accent} stopOpacity={0.32} />
            <Stop offset="62%" stopColor={s.accent} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={s.baseColor} />
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#sec-${s.id})`}
        />
      </Svg>

      <View
        style={[
          styles.sectionIconTile,
          {
            backgroundColor: `${s.accent}22`,
            borderColor: `${s.accent}55`,
          },
        ]}>
        {s.renderIcon(24, s.accent)}
      </View>

      <View style={styles.sectionBody}>
        <Text style={styles.sectionTitle}>{s.title}</Text>
      </View>

      <AppIcon
        name="chevron-right"
        size={20}
        color={s.accent}
        style={styles.sectionChevron}
      />
    </FocusablePressable>
  );
});

// ─────────────────────────────────────────────────────────────
// Continue watching
// ─────────────────────────────────────────────────────────────
const POSTER_GRADIENTS: Record<string, string[]> = {
  movie: ['#2a1505', '#6b2e0b', '#ef4fa7'],
  series: ['#0a2540', '#1e3a5f', '#22d3ee'],
  live: ['#1a0b1f', '#4a1537', '#ef4fa7'],
};
const TYPE_ACCENT: Record<string, string> = {
  movie: colors.magenta,
  series: colors.cyan,
  live: colors.magentaOnAir,
};

function LivePulse({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const pulseStyle = {
    backgroundColor: color,
    opacity: anim,
    transform: [{ scale: anim }],
  };
  return <Animated.View style={[styles.livePulse, pulseStyle]} />;
}

const ContinueCard = React.memo(function ContinueCard({
  item,
  onPressItem,
  playlistId,
}: {
  item: LatestWatched;
  onPressItem: (item: LatestWatched) => void;
  playlistId: string | null;
}) {
  const type = item.type;
  const accent = TYPE_ACCENT[type] || colors.indigo;
  const isLive = type === 'live';
  const progressPct =
    item.progress && item.totalDuration
      ? Math.max(0, Math.min(100, (item.progress / item.totalDuration) * 100))
      : isLive
      ? 80
      : 0;

  // meta + remaining
  let meta = '';
  if (type === 'series') {
    const parts: string[] = [];
    if (item.seasonNumber) parts.push(`S${item.seasonNumber}`);
    if (item.episodeNumber) parts.push(`E${item.episodeNumber}`);
    meta = parts.length ? parts.join(' · ') : 'Series';
  } else if (type === 'live') {
    meta = `Live · ${item.channelName || item.name}`;
  } else {
    meta = 'Movie';
  }

  let remaining = '';
  if (isLive) {
    remaining = 'On air';
  } else if (item.progress && item.totalDuration) {
    const left = Math.max(0, item.totalDuration - item.progress);
    const min = Math.ceil(left / 60);
    remaining =
      min >= 60
        ? `${Math.floor(min / 60)}h ${min % 60}m left`
        : `${min} min left`;
  }

  const handlePress = useCallback(() => onPressItem(item), [item, onPressItem]);
  const accessibilityLabel = [item.name, meta, remaining]
    .filter(Boolean)
    .join(', ');

  return (
    <FocusablePressable
      style={styles.continueCard}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${accessibilityLabel}`}>
      <View style={styles.posterWrap}>
        <CachedRemoteImage
          uri={item.thumbnail}
          playlistId={playlistId}
          contentId={continueKeyExtractor(item)}
          variant="continue-watching"
          style={StyleSheet.absoluteFill}
          displayWidth={180}
          displayHeight={112.5}
          fallback={
            <LinearGradient
              colors={POSTER_GRADIENTS[type] || POSTER_GRADIENTS.movie}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          }
        />

        {/* play badge */}
        <View style={styles.playBadge}>
          <AppIcon name="play" size={11} color={colors.white} />
        </View>

        {/* live badge */}
        {isLive && (
          <View style={styles.liveBadge}>
            <LivePulse color={colors.magenta} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}

        {/* progress */}
        <View style={styles.posterProgressTrack}>
          <View
            style={[
              styles.posterProgressFill,
              {
                width: `${progressPct}%`,
                backgroundColor: accent,
                shadowColor: accent,
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.continueTitle} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.continueMeta} numberOfLines={1}>
        {meta}
      </Text>
      {!!remaining && (
        <Text style={[styles.continueRemaining, { color: accent }]}>
          {remaining}
        </Text>
      )}
    </FocusablePressable>
  );
});

const continueKeyExtractor = (item: LatestWatched) =>
  item.type === 'series'
    ? `series-${item.seriesId}-${item.episodeId}`
    : item.type === 'live'
    ? `live-${item.streamId}`
    : `movie-${item.id}`;
const ContinueSeparator = () => <View style={styles.continueSeparator} />;

function EmptyContinue() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <AppIcon name="play" size={15} color={colors.indigo} />
      </View>
      <View style={styles.emptyBody}>
        <Text style={styles.emptyTitle}>Nothing to resume</Text>
        <Text style={styles.emptySub}>
          Start a movie or show — we'll pick up where you left off.
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
export default function HomeScreenBrand({ navigation }: HomeScreenProps) {
  const isFocused = useIsFocused();
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
  const accountQuery = useXtreamAccountInfo(session, isFocused);
  const subscription = accountQuery.data
    ? createSubscriptionSummary(accountQuery.data)
    : null;

  const [recentWatches, setRecentWatches] = useState<LatestWatched[]>([]);

  // Load recent watches
  useEffect(() => {
    const load = async () => {
      const watches = await storage.getLatestWatched();
      setRecentWatches(watches || []);
    };
    if (isFocused) load();
  }, [isFocused]);

  const refetchAccount = accountQuery.refetch;
  const handleSubscriptionRetry = useCallback(() => {
    refetchAccount();
  }, [refetchAccount]);

  const openContinueItem = useCallback(
    (item: LatestWatched) => {
      navigation.navigate('VideoPlayer', {
        request: historyEntryToPlaybackRequest(item),
      });
    },
    [navigation],
  );

  const openHistory = useCallback(
    () => navigation.navigate('WatchHistory'),
    [navigation],
  );

  const openSettings = useCallback(
    () => navigation.navigate('Settings'),
    [navigation],
  );
  const openSection = useCallback(
    (sectionId: SectionDef['id']) =>
      navigation.navigate(NAV_BY_SECTION[sectionId]),
    [navigation],
  );
  const renderContinueItem = useCallback(
    ({ item }: { item: LatestWatched }) => (
      <ContinueCard
        item={item}
        playlistId={playlistId}
        onPressItem={openContinueItem}
      />
    ),
    [openContinueItem, playlistId],
  );

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <GridBg />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <Header subId={username || 'SUB-—'} onSettings={openSettings} />

          {subscription ? (
            <SubscriptionCard sub={subscription} />
          ) : accountQuery.isPending ? (
            <SubscriptionLoadingCard />
          ) : (
            <SubscriptionRetryCard onRetry={handleSubscriptionRetry} />
          )}

          <View style={styles.sectionsBlock}>
            {SECTIONS.map(s => (
              <SectionTile key={s.id} s={s} onPress={openSection} />
            ))}
          </View>

          {/* Continue watching */}
          <View style={styles.continueHeader}>
            <View>
              <Text style={styles.continueEyebrow}>
                PICK UP WHERE YOU LEFT OFF
              </Text>
              <Text style={styles.continueHeading}>Continue watching</Text>
            </View>
            <FocusablePressable
              style={styles.seeAllButton}
              onPress={openHistory}
              accessibilityRole="button"
              accessibilityLabel="See all watch history">
              <Text style={styles.seeAllText}>See all</Text>
              <AppIcon
                name="chevron-right"
                size={11}
                color={colors.indigo}
              />
            </FocusablePressable>
          </View>

          {recentWatches.length > 0 ? (
            <FlatList
              data={recentWatches}
              renderItem={renderContinueItem}
              keyExtractor={continueKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.continueCarousel}
              ItemSeparatorComponent={ContinueSeparator}
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={5}
              nestedScrollEnabled
            />
          ) : (
            <EmptyContinue />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 12,
    padding: 1.5,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 10.5,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.8,
    color: colors.indigo,
  },
  subId: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '600',
    color: colors.fg,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Subscription card
  subCard: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  subscriptionSkeleton: {
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
  },
  subscriptionSkeletonTag: {
    width: 132,
    height: 22,
  },
  subscriptionSkeletonValue: {
    width: 92,
    height: 34,
    marginTop: 18,
  },
  subscriptionSkeletonBar: {
    width: '100%',
    height: 4,
    marginTop: 14,
  },
  subscriptionSkeletonMeta: {
    width: '48%',
    height: 10,
    marginTop: 12,
  },
  subscriptionErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscriptionErrorCopy: {
    flex: 1,
  },
  subscriptionErrorTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: colors.fg,
  },
  subscriptionErrorMessage: {
    marginTop: 3,
    fontFamily: FONT,
    fontSize: 12,
    color: colors.fgMuted,
  },
  subscriptionRetryButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.glass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  subscriptionRetryText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: colors.fg,
  },
  subHalo: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  subTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexShrink: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  statusText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    color: colors.fg,
    letterSpacing: 0.4,
  },
  viewOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    marginLeft: 10,
  },
  viewOnlyText: {
    fontFamily: MONO,
    fontSize: 11,
    color: colors.fgSubtle,
    fontWeight: '500',
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  daysNumber: {
    fontFamily: MONO,
    fontSize: 34,
    fontWeight: '600',
    color: colors.fg,
    lineHeight: 36,
  },
  daysLabel: {
    fontFamily: FONT,
    fontSize: 15,
    color: colors.fgMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  progressTrack: {
    marginTop: 12,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  subFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subFooterText: {
    fontFamily: MONO,
    fontSize: 11,
    color: colors.fgSubtle,
  },
  warningBanner: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 11.5,
    color: colors.fg,
  },

  // Sections
  sectionsBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  sectionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 84,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionIconTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBody: {
    flex: 1,
    minWidth: 0,
  },
  sectionChevron: {
    opacity: 0.7,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '600',
    color: colors.fg,
  },
  sectionSub: {
    marginTop: 3,
    fontFamily: MONO,
    fontSize: 12,
    color: colors.fgMuted,
  },
  sectionStatRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionStatLabel: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  sectionStatDot: {
    color: colors.fgSubtle,
    fontSize: 12,
  },
  sectionStatValue: {
    fontFamily: FONT,
    fontSize: 12,
    color: colors.fgMuted,
  },

  // Continue watching
  continueHeader: {
    marginTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  continueEyebrow: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.8,
    color: colors.indigo,
    marginBottom: 4,
  },
  continueHeading: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: '600',
    color: colors.fg,
  },
  seeAllButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  seeAllText: {
    color: colors.indigo,
    fontSize: 13,
    fontWeight: '700',
  },
  continueCarousel: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  continueSeparator: {
    width: 12,
  },
  continueCard: {
    width: 180,
  },
  posterWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10,14,30,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(239,79,167,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,79,167,0.4)',
  },
  liveBadgeText: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1,
  },
  livePulse: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  posterProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  posterProgressFill: {
    height: '100%',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  continueTitle: {
    marginTop: 10,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: colors.fg,
  },
  continueMeta: {
    marginTop: 2,
    fontFamily: MONO,
    fontSize: 11,
    color: colors.fgSubtle,
  },
  continueRemaining: {
    marginTop: 3,
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
  },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyBody: {
    flex: 1,
  },
  emptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(139,123,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,123,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: colors.fg,
  },
  emptySub: {
    marginTop: 2,
    fontFamily: FONT,
    fontSize: 12,
    color: colors.fgSubtle,
  },
});
