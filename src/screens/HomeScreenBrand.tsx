import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
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
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';

import type { TabParamList, TabScreenProps } from '../navigation/types';
import { RootState } from '../store';
import { storage, type LatestWatched } from '../utils/storage';
import { proxyStreamUrl, unwrapProxyUrl } from '../utils/proxy';
import {
  buildMovieStreamUrl,
  buildPlayerApiUrl,
  buildSeriesStreamUrl,
} from '../utils/xtream';
import { colors, sectionAccents, radii, gradients } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';

type HomeScreenProps = TabScreenProps<'Home'>;

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ─────────────────────────────────────────────────────────────
// Faint grid backdrop — fades out toward the edges
// ─────────────────────────────────────────────────────────────
function GridBg() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="grid"
          width={32}
          height={32}
          patternUnits="userSpaceOnUse"
        >
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
          style={styles.avatarRing}
        >
          <View style={styles.avatarInner}>
            <FontAwesome5 name="user" size={18} color={colors.indigo} />
          </View>
        </LinearGradient>
        <View>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.subId} numberOfLines={1}>
            {subId}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.settingsBtn}
        activeOpacity={0.7}
        onPress={onSettings}
      >
        <Ionicons name="settings-sharp" size={18} color={colors.fgMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Subscription card
// ─────────────────────────────────────────────────────────────
interface SubInfo {
  daysLeft: number | null;
  totalDays: number;
  plan: string;
  expiresOn: string;
  status: 'active' | 'trial' | 'expired';
}

function SubscriptionCard({ sub }: { sub: SubInfo | null }) {
  const rawDays = sub?.daysLeft ?? null;
  // Far-future expiry (panels often set ~year 2099 for non-expiring) reads as unlimited.
  const unlimited = rawDays != null && rawDays > 3650;
  const daysLeft = unlimited ? null : rawDays;
  const totalDays = sub?.totalDays ?? 90;
  const isTrial = sub?.status === 'trial';
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
  const statusLabel = isTrial ? 'trial' : sub?.status === 'expired' ? 'expired' : 'active';
  const plan = sub?.plan ?? 'Premium';
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
          ]}
        >
          <View
            style={[styles.statusDot, { backgroundColor: dot, shadowColor: dot }]}
          />
          <Text style={styles.statusText} numberOfLines={1}>
            {plan} · {statusLabel}
          </Text>
        </View>
        <View style={styles.viewOnly}>
          <FontAwesome5 name="eye" size={11} color={colors.fgSubtle} />
          <Text style={styles.viewOnlyText}>View only</Text>
        </View>
      </View>

      <View style={styles.daysRow}>
        <Text style={styles.daysNumber}>
          {daysLeft == null ? '∞' : daysLeft}
        </Text>
        <Text style={styles.daysLabel}>days left</Text>
      </View>

      <View style={styles.progressTrack}>
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
          {unlimited ? 'No expiry date' : `Expires ${sub?.expiresOn ?? '—'}`}
        </Text>
        <Text style={styles.subFooterText}>
          {unlimited ? 'Unlimited' : `${totalDays}d plan`}
        </Text>
      </View>

      {isWarning && (
        <View style={styles.warningBanner}>
          <FontAwesome5
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
      <MaterialCommunityIcons name="radio-tower" size={size} color={color} />
    ),
  },
  {
    id: 'movies',
    title: 'Movies',
    accent: sectionAccents.movies,
    baseColor: '#0e1126',
    corner: { cx: '98%', cy: '2%' },
    renderIcon: (size, color) => (
      <MaterialCommunityIcons name="movie-open" size={size} color={color} />
    ),
  },
  {
    id: 'series',
    title: 'Series',
    accent: sectionAccents.series,
    baseColor: '#08141f',
    corner: { cx: '2%', cy: '98%' },
    renderIcon: (size, color) => (
      <FontAwesome5 name="tv" size={size} color={color} />
    ),
  },
];

function SectionTile({
  s,
  onPress,
}: {
  s: SectionDef;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.sectionTile, { borderColor: `${s.accent}30` }]}
    >
      {/* background: solid base + soft accent corner glow (radial, fades before edge) */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgRadialGradient
            id={`sec-${s.id}`}
            cx={s.corner.cx}
            cy={s.corner.cy}
            r="80%"
          >
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
        ]}
      >
        {s.renderIcon(24, s.accent)}
      </View>

      <View style={styles.sectionBody}>
        <Text style={styles.sectionTitle}>{s.title}</Text>
      </View>

      <FontAwesome5
        name="chevron-right"
        size={20}
        color={s.accent}
        style={styles.sectionChevron}
      />
    </TouchableOpacity>
  );
}

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
  return (
    <Animated.View
      style={[styles.livePulse, pulseStyle]}
    />
  );
}

function ContinueCard({
  item,
  onPress,
}: {
  item: any;
  onPress: () => void;
}) {
  const type = item.type || 'movie';
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
      min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m left` : `${min} min left`;
  }

  return (
    <TouchableOpacity
      style={styles.continueCard}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.posterWrap}>
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={POSTER_GRADIENTS[type] || POSTER_GRADIENTS.movie}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* play badge */}
        <View style={styles.playBadge}>
          <FontAwesome5 name="play" size={11} color={colors.white} solid />
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
    </TouchableOpacity>
  );
}

function EmptyContinue() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <FontAwesome5 name="play" size={15} color={colors.indigo} solid />
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
  const { username, password, serverDomain, serverPort, useProxy } =
    useSelector((s: RootState) => s.user);

  const [recentWatches, setRecentWatches] = useState<LatestWatched[]>([]);
  const [sub, setSub] = useState<SubInfo | null>(null);

  // Load recent watches
  useEffect(() => {
    const load = async () => {
      const watches = await storage.getLatestWatched();
      setRecentWatches(watches || []);
    };
    if (isFocused) load();
  }, [isFocused]);

  // Fetch subscription (user_info) once per focus
  useEffect(() => {
    let cancelled = false;
    const loadSub = async () => {
      if (!serverDomain || !username) return;
      try {
        const original = buildPlayerApiUrl({
          domain: serverDomain,
          port: serverPort,
          username,
          password,
          action: '',
        });
        const url = proxyStreamUrl(original, useProxy);
        const res = await axios.get(url);
        const info = res?.data?.user_info;
        if (!info || cancelled) return;

        const expUnix = Number(info.exp_date);
        const hasExp = !!expUnix && !Number.isNaN(expUnix);
        const expMs = hasExp ? expUnix * 1000 : 0;
        const dayMs = 86400000;
        const daysLeft = hasExp
          ? Math.max(0, Math.ceil((expMs - Date.now()) / dayMs))
          : null;

        const createdUnix = Number(info.created_at);
        const hasCreated = !!createdUnix && !Number.isNaN(createdUnix);
        const totalDays =
          hasCreated && hasExp
            ? Math.max(1, Math.ceil((expMs - createdUnix * 1000) / dayMs))
            : Math.max(daysLeft ?? 90, 90);

        const isTrial = String(info.is_trial) === '1';
        const rawStatus = String(info.status || '').toLowerCase();
        const status: SubInfo['status'] = isTrial
          ? 'trial'
          : rawStatus.includes('expire')
            ? 'expired'
            : 'active';

        let expiresOn = '—';
        if (hasExp) {
          const d = new Date(expMs);
          expiresOn = `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(
            2,
            '0',
          )}, ${d.getFullYear()}`;
        }

        const plan = isTrial ? 'Trial access' : 'Premium 4K';

        setSub({ daysLeft, totalDays, plan, expiresOn, status });
      } catch {
        // graceful: leave card in loading/fallback state
      }
    };
    if (isFocused) loadSub();
    return () => {
      cancelled = true;
    };
  }, [isFocused, serverDomain, serverPort, username, password, useProxy]);

  const openContinueItem = (item: LatestWatched) => {
    if (item.type === 'series') {
      const original = item.streamUrl
        ? unwrapProxyUrl(item.streamUrl)
        : buildSeriesStreamUrl({
            domain: serverDomain,
            port: serverPort,
            username,
            password,
            streamId: item.episodeId,
            extension: item.containerExtension || 'mp4',
          });
      const url = proxyStreamUrl(original, useProxy);
      navigation.navigate('VideoPlayer', {
        streamUrl: url,
        streamId: item.episodeId,
        containerExtension: item.containerExtension || 'mp4',
        isLive: false,
        title: item.name,
        seriesId: item.seriesId,
        episodeId: item.episodeId,
        thumbnail: item.thumbnail,
        continueTime: {
          progress: item.progress ?? 0,
          totalDuration: item.totalDuration,
        },
      });
    } else if (item.type === 'movie') {
      const original = item.streamUrl
        ? unwrapProxyUrl(item.streamUrl)
        : buildMovieStreamUrl({
            domain: serverDomain,
            port: serverPort,
            username,
            password,
            streamId: item.id,
            extension: item.containerExtension || 'mp4',
          });
      const url = proxyStreamUrl(original, useProxy);
      navigation.navigate('VideoPlayer', {
        streamUrl: url,
        streamId: item.id,
        containerExtension: item.containerExtension || 'mp4',
        isLive: false,
        title: item.name,
        movieId: item.id,
        thumbnail: item.thumbnail,
        continueTime: {
          progress: item.progress ?? 0,
          totalDuration: item.totalDuration,
        },
      });
    } else if (item.type === 'live') {
      const url = proxyStreamUrl(unwrapProxyUrl(item.streamUrl), useProxy);
      navigation.navigate('VideoPlayer', {
        streamUrl: url,
        streamId: item.streamId,
        containerExtension: item.containerExtension,
        isLive: true,
        channelName: item.channelName,
        title: item.channelName,
        thumbnail: item.thumbnail,
        categoryId: item.categoryId,
      });
    }
  };

  const navBySection: Record<SectionDef['id'], keyof TabParamList> = {
    live: 'LiveTV',
    movies: 'Movies',
    series: 'Series',
  };

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <GridBg />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Header
            subId={username || 'SUB-—'}
            onSettings={() => navigation.navigate('Settings')}
          />

          <SubscriptionCard sub={sub} />

          <View style={styles.sectionsBlock}>
            {SECTIONS.map(s => (
              <SectionTile
                key={s.id}
                s={s}
                onPress={() => navigation.navigate(navBySection[s.id])}
              />
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
            {recentWatches.length > 0 && (
              <TouchableOpacity>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentWatches.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.continueCarousel}
            >
              {recentWatches.map((item, idx) => (
                <ContinueCard
                  key={item.id ? `${item.type}-${item.id}` : idx}
                  item={item}
                  onPress={() => openContinueItem(item)}
                />
              ))}
            </ScrollView>
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
    width: 40,
    height: 40,
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
  seeAll: {
    fontFamily: FONT,
    fontSize: 12,
    color: colors.fgMuted,
    fontWeight: '500',
  },
  continueCarousel: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 12,
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
