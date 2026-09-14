import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import type { RootScreenProps } from '../navigation/types';
import type { RootState } from '../store';
import { colors, radii, space } from '../theme/colors';
import AppIcon, { type AppIconName } from '../components/AppIcon';
import CachedRemoteImage from '../components/CachedRemoteImage';
import FocusablePressable from '../tv/FocusablePressable';
import AmbientGlow from '../components/mirror/AmbientGlow';
import {
  storage,
  watchHistoryIdentity,
  type WatchHistoryEntry,
} from '../utils/storage';
import {
  filterWatchHistory,
  HISTORY_FILTERS,
  type HistoryFilter,
} from '../utils/historyFilters';
import { historyEntryToPlaybackRequest } from '../utils/historyPlayback';

type Props = RootScreenProps<'WatchHistory'>;
const IS_TV = Platform.isTV;
const FILTER_LABELS: Record<HistoryFilter, string> = {
  all: 'All',
  movie: 'Movies',
  series: 'Series',
  live: 'Live',
};
const TYPE_ICONS: Record<WatchHistoryEntry['type'], AppIconName> = {
  movie: 'film',
  series: 'tv',
  live: 'broadcast-tower',
};

function historyMeta(item: WatchHistoryEntry): string {
  if (item.type === 'live') return 'Live channel';
  if (item.type === 'movie') return 'Movie';
  const numbers = [
    item.seasonNumber ? `S${item.seasonNumber}` : '',
    item.episodeNumber ? `E${item.episodeNumber}` : '',
  ].filter(Boolean);
  return [item.seriesName, numbers.join(' · ') || 'Series episode']
    .filter(Boolean)
    .join(' · ');
}

const HistoryRow = React.memo(function HistoryRow({
  item,
  playlistId,
  onOpen,
  onRemove,
}: {
  item: WatchHistoryEntry;
  playlistId: string | null;
  onOpen: (item: WatchHistoryEntry) => void;
  onRemove: (item: WatchHistoryEntry) => void;
}) {
  const handleOpen = useCallback(() => onOpen(item), [item, onOpen]);
  const handleRemove = useCallback(() => onRemove(item), [item, onRemove]);
  const meta = historyMeta(item);

  return (
    <View style={styles.historyCard}>
      <FocusablePressable
        style={styles.historyMain}
        focusScale={IS_TV ? 1.025 : 1}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={`Play ${item.name}, ${meta}${
          item.completed ? ', watched' : ''
        }`}>
        <CachedRemoteImage
          uri={item.thumbnail}
          playlistId={playlistId}
          contentId={watchHistoryIdentity(item)}
          variant="continue-watching"
          style={styles.thumbnail}
          displayWidth={112}
          displayHeight={70}
          fallback={
            <View style={styles.thumbnailFallback}>
              <AppIcon
                name={TYPE_ICONS[item.type]}
                size={24}
                color={colors.fgSubtle}
              />
            </View>
          }
        />
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
          {item.completed ? (
            <View style={styles.watchedBadge}>
              <AppIcon name="check" size={10} color={colors.success} />
              <Text style={styles.watchedText}>Watched</Text>
            </View>
          ) : null}
        </View>
        <AppIcon name="chevron-right" size={15} color={colors.fgSubtle} />
      </FocusablePressable>
      <FocusablePressable
        style={styles.removeButton}
        onPress={handleRemove}
        focusScale={1.08}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name} from history`}>
        <AppIcon name="trash-alt" size={15} color={colors.fgMuted} />
      </FocusablePressable>
    </View>
  );
});

const keyExtractor = (item: WatchHistoryEntry) => watchHistoryIdentity(item);

export default function WatchHistoryScreen({ navigation }: Props) {
  const playlistId = useSelector((state: RootState) => state.user.playlistId);
  const [items, setItems] = useState<WatchHistoryEntry[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    const history = await storage.getWatchHistory();
    setItems(history);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  const filteredItems = useMemo(
    () => filterWatchHistory(items, filter),
    [filter, items],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const handleOpen = useCallback(
    (item: WatchHistoryEntry) => {
      navigation.navigate('VideoPlayer', {
        request: historyEntryToPlaybackRequest(item),
      });
    },
    [navigation],
  );

  const removeConfirmed = useCallback(async (item: WatchHistoryEntry) => {
    await storage.removeHistoryEntry(item);
    setItems(current =>
      current.filter(
        candidate =>
          watchHistoryIdentity(candidate) !== watchHistoryIdentity(item),
      ),
    );
  }, []);

  const handleRemove = useCallback(
    (item: WatchHistoryEntry) => {
      Alert.alert(
        'Remove from history?',
        `Remove “${item.name}” and its saved progress?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeConfirmed(item),
          },
        ],
      );
    },
    [removeConfirmed],
  );

  const clearConfirmed = useCallback(async () => {
    await storage.clearWatchHistory();
    setItems([]);
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear all watch history?',
      'This also clears saved movie and episode progress. Favorites and playlists are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: clearConfirmed },
      ],
    );
  }, [clearConfirmed]);

  const renderItem = useCallback(
    ({ item }: { item: WatchHistoryEntry }) => (
      <HistoryRow
        item={item}
        playlistId={playlistId}
        onOpen={handleOpen}
        onRemove={handleRemove}
      />
    ),
    [handleOpen, handleRemove, playlistId],
  );

  return (
    <View style={styles.root}>
      <AmbientGlow accent={colors.indigo} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <FocusablePressable
            style={styles.headerButton}
            onPress={navigation.goBack}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <AppIcon name="arrow-left" size={17} color={colors.fg} />
          </FocusablePressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YOUR LIBRARY</Text>
            <Text style={styles.heading}>Watch history</Text>
          </View>
          <FocusablePressable
            style={styles.headerButton}
            onPress={handleClear}
            disabled={items.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Clear all watch history"
            accessibilityState={{ disabled: items.length === 0 }}>
            <AppIcon
              name="trash-alt"
              size={16}
              color={items.length ? colors.danger : colors.fgSubtle}
            />
          </FocusablePressable>
        </View>

        <View style={styles.filters}>
          {HISTORY_FILTERS.map(value => {
            const selected = value === filter;
            return (
              <FocusablePressable
                key={value}
                style={[styles.filter, selected && styles.filterSelected]}
                onPress={() => setFilter(value)}
                // TV: give the remote a starting point when the screen opens.
                hasTVPreferredFocus={IS_TV && selected}
                accessibilityRole="tab"
                accessibilityState={{ selected }}>
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}>
                  {FILTER_LABELS[value]}
                </Text>
              </FocusablePressable>
            );
          })}
        </View>

        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={HistorySeparator}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={!IS_TV}
          refreshControl={
            IS_TV ? undefined : (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.indigo}
                colors={[colors.indigo]}
              />
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <AppIcon name="history" size={26} color={colors.indigo} />
              </View>
              <Text style={styles.emptyTitle}>No history here yet</Text>
              <Text style={styles.emptyText}>
                Successfully played movies, episodes, and live channels will
                appear here.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const HistorySeparator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s5,
    paddingTop: space.s2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  eyebrow: {
    color: colors.indigo,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.7,
  },
  heading: { color: colors.fg, fontSize: 22, fontWeight: '700', marginTop: 2 },
  filters: {
    flexDirection: 'row',
    gap: space.s2,
    paddingHorizontal: space.s5,
    paddingVertical: space.s4,
  },
  filter: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: space.s4,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterSelected: {
    backgroundColor: 'rgba(139,123,255,0.2)',
    borderColor: 'rgba(139,123,255,0.65)',
  },
  filterText: { color: colors.fgMuted, fontSize: 13, fontWeight: '600' },
  filterTextSelected: { color: colors.fg },
  listContent: { paddingHorizontal: space.s5, paddingBottom: 44, flexGrow: 1 },
  separator: { height: space.s3 },
  historyCard: {
    flexDirection: 'row',
    minHeight: 92,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  historyMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
  },
  thumbnail: { width: 112, height: 70, borderRadius: radii.sm },
  thumbnailFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.fg, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.fgMuted, fontSize: 12, marginTop: 5 },
  watchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 7,
  },
  watchedText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  removeButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.borderStrong,
  },
  empty: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,123,255,0.14)',
  },
  emptyTitle: {
    color: colors.fg,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    color: colors.fgMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
  },
});
