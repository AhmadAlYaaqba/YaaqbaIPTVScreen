import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import AppIcon from './AppIcon';
import CachedRemoteImage from './CachedRemoteImage';
import TVTouchable from '../tv/TVTouchable';
import { colors } from '../theme/colors';
import {
  storage,
  type FavoriteChannel,
  type RecentChannel,
} from '../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.round(SCREEN_WIDTH * 0.68);
const CHANNEL_SKELETON_ITEMS = Array.from({ length: 10 }, (_, index) => index);
const IS_TV = Platform.isTV;
const TV_ITEM_HEIGHT = 60;

type SwitcherSegment = 'category' | 'favorites' | 'recent';

interface Channel {
  stream_id: number | string;
  name: string;
  stream_icon?: string;
  icon?: string;
  container_extension?: string;
  category_id?: string | number;
}

interface SwitcherChannel {
  streamId: string;
  name: string;
  thumbnail?: string;
  extension: string;
  categoryId?: string;
}

interface ChannelSwitcherProps {
  playlistId: string | null;
  visible: boolean;
  channels: Channel[];
  currentCategoryId?: string;
  activeStreamId: string;
  isLoading: boolean;
  isOffline: boolean;
  error?: string | null;
  onRetry: () => void;
  onSelectChannel: (
    streamId: string,
    channelName: string,
    extension: string,
    thumbnail?: string,
    categoryId?: string,
  ) => void;
  onClose: () => void;
}

const ChannelItem = React.memo(function ChannelItem({
  item,
  isActive,
  isFavorite,
  playlistId,
  onSelect,
  onToggleFavorite,
}: {
  item: SwitcherChannel;
  isActive: boolean;
  isFavorite: boolean;
  playlistId: string | null;
  onSelect: (item: SwitcherChannel) => void;
  onToggleFavorite: (item: SwitcherChannel) => void;
}) {
  const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
  const handleFavorite = useCallback(
    () => onToggleFavorite(item),
    [item, onToggleFavorite],
  );

  return (
    <View
      style={[
        styles.channelItem,
        IS_TV && styles.channelItemTV,
        isActive && styles.channelItemActive,
      ]}>
      <TVTouchable
        style={styles.channelMain}
        onPress={handlePress}
        hasTVPreferredFocus={IS_TV && isActive}
        focusScale={1}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`${item.name}${isActive ? ', now playing' : ''}`}>
        <CachedRemoteImage
          uri={item.thumbnail}
          playlistId={playlistId}
          contentId={item.streamId}
          variant="channel-logo"
          style={styles.channelIcon}
          contentFit="contain"
          displayWidth={32}
          displayHeight={32}
          fallback={
            <View style={styles.channelIconPlaceholder}>
              <AppIcon name="tv" size={14} color={colors.fgSubtle} />
            </View>
          }
        />
        <Text
          style={[styles.channelName, isActive && styles.channelNameActive]}
          numberOfLines={IS_TV ? 1 : 2}>
          {item.name}
        </Text>
        {isActive ? (
          <View style={styles.nowPlaying}>
            <View style={styles.nowPlayingDot} />
          </View>
        ) : null}
      </TVTouchable>
      <TVTouchable
        style={styles.favoriteButton}
        onPress={handleFavorite}
        focusScale={1.1}
        accessibilityRole="button"
        accessibilityLabel={`${isFavorite ? 'Remove' : 'Add'} ${item.name} ${
          isFavorite ? 'from' : 'to'
        } favorites`}
        accessibilityState={{ selected: isFavorite }}>
        <AppIcon
          name="star"
          size={15}
          color={isFavorite ? colors.warning : colors.fgSubtle}
        />
      </TVTouchable>
    </View>
  );
});

const ChannelListSkeleton = React.memo(() => (
  <View style={styles.skeletonList}>
    {CHANNEL_SKELETON_ITEMS.map(item => (
      <View key={item} style={styles.skeletonRow}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonText} />
      </View>
    ))}
  </View>
));

const SEGMENT_LABELS: Record<SwitcherSegment, string> = {
  category: 'Category',
  favorites: 'Favorites',
  recent: 'Recent',
};

export default React.memo(function ChannelSwitcher({
  playlistId,
  visible,
  channels,
  currentCategoryId,
  activeStreamId,
  isLoading,
  isOffline,
  error,
  onRetry,
  onSelectChannel,
  onClose,
}: ChannelSwitcherProps) {
  const translateX = useSharedValue(PANEL_WIDTH);
  const backdropOpacity = useSharedValue(0);
  const [segment, setSegment] = useState<SwitcherSegment>('category');
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);
  const [recents, setRecents] = useState<RecentChannel[]>([]);

  useEffect(() => {
    if (visible) {
      translateX.value = withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, { duration: 200 });
      Promise.all([
        storage.reconcileFavoriteChannels(channels, playlistId),
        storage.getRecentChannels(playlistId),
      ]).then(([nextFavorites, nextRecents]) => {
        setFavorites(nextFavorites);
        setRecents(nextRecents);
      });
    } else {
      translateX.value = withTiming(PANEL_WIDTH, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
      backdropOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [backdropOpacity, channels, playlistId, translateX, visible]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const categoryChannels = useMemo<SwitcherChannel[]>(
    () =>
      channels.map(item => ({
        streamId: String(item.stream_id),
        name: item.name,
        thumbnail: item.stream_icon || item.icon,
        extension:
          item.container_extension?.replace(/^\./, '') || 'm3u8',
        categoryId:
          item.category_id != null
            ? String(item.category_id)
            : currentCategoryId,
      })),
    [channels, currentCategoryId],
  );
  const favoriteChannels = useMemo<SwitcherChannel[]>(
    () =>
      favorites.map(item => ({
        streamId: item.streamId,
        name: item.name,
        thumbnail: item.icon,
        extension: item.extension,
        categoryId: item.categoryId,
      })),
    [favorites],
  );
  const recentChannels = useMemo<SwitcherChannel[]>(
    () =>
      recents.map(item => ({
        streamId: item.streamId,
        name: item.name,
        thumbnail: item.icon,
        extension: item.extension,
        categoryId: item.categoryId,
      })),
    [recents],
  );
  const data =
    segment === 'category'
      ? categoryChannels
      : segment === 'favorites'
        ? favoriteChannels
        : recentChannels;
  const favoriteIds = useMemo(
    () => new Set(favorites.map(item => item.streamId)),
    [favorites],
  );

  const handleSelect = useCallback(
    (item: SwitcherChannel) => {
      if (item.streamId !== activeStreamId) {
        onSelectChannel(
          item.streamId,
          item.name,
          item.extension,
          item.thumbnail,
          item.categoryId,
        );
      }
      onClose();
    },
    [activeStreamId, onClose, onSelectChannel],
  );

  const handleToggleFavorite = useCallback(
    (item: SwitcherChannel) => {
      storage
        .toggleFavoriteChannel(
          {
            streamId: item.streamId,
            name: item.name,
            extension: item.extension,
            icon: item.thumbnail,
            categoryId: item.categoryId,
          },
          playlistId,
        )
        .then(setFavorites);
    },
    [playlistId],
  );

  const renderItem = useCallback(
    ({ item }: { item: SwitcherChannel }) => (
      <ChannelItem
        item={item}
        isActive={item.streamId === activeStreamId}
        isFavorite={favoriteIds.has(item.streamId)}
        playlistId={playlistId}
        onSelect={handleSelect}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [
      activeStreamId,
      favoriteIds,
      handleSelect,
      handleToggleFavorite,
      playlistId,
    ],
  );
  const keyExtractor = useCallback(
    (item: SwitcherChannel) => item.streamId,
    [],
  );
  const activeIndex = useMemo(
    () =>
      IS_TV && segment === 'category'
        ? data.findIndex(item => item.streamId === activeStreamId)
        : -1,
    [activeStreamId, data, segment],
  );
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: TV_ITEM_HEIGHT,
      offset: TV_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  if (!visible) return null;

  const emptyTitle =
    segment === 'favorites'
      ? 'No favorite channels yet'
      : segment === 'recent'
        ? 'No recently viewed channels'
        : isOffline
          ? 'Channels unavailable offline'
          : error
            ? 'Could not load channels'
            : 'No channels in this category';

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.panel, panelStyle]}
        accessibilityViewIsModal
        accessibilityLabel="Channel list">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Channels</Text>
          <TVTouchable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close channel list">
            <AppIcon name="times" size={16} color={colors.fgMuted} />
          </TVTouchable>
        </View>

        <View style={styles.segments}>
          {(Object.keys(SEGMENT_LABELS) as SwitcherSegment[]).map(value => {
            const selected = segment === value;
            return (
              <TVTouchable
                key={value}
                style={[styles.segment, selected && styles.segmentSelected]}
                onPress={() => setSegment(value)}
                focusScale={1.04}
                accessibilityRole="tab"
                accessibilityState={{ selected }}>
                <Text
                  style={[
                    styles.segmentText,
                    selected && styles.segmentTextSelected,
                  ]}>
                  {SEGMENT_LABELS[value]}
                </Text>
              </TVTouchable>
            );
          })}
        </View>

        {data.length > 0 ? (
          <FlatList
            data={data}
            key={`${segment}:${currentCategoryId ?? 'none'}`}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={!IS_TV}
            getItemLayout={IS_TV ? getItemLayout : undefined}
            initialScrollIndex={activeIndex > 0 ? activeIndex : undefined}
          />
        ) : segment === 'category' && isLoading ? (
          <ChannelListSkeleton />
        ) : (
          <View style={styles.stateContainer}>
            <AppIcon
              name={
                segment === 'favorites'
                  ? 'star'
                  : segment === 'recent'
                    ? 'history'
                    : isOffline
                      ? 'wifi'
                      : error
                        ? 'exclamation-circle'
                        : 'inbox'
              }
              size={28}
              color={error ? colors.danger : colors.fgSubtle}
            />
            <Text style={styles.stateTitle}>{emptyTitle}</Text>
            {segment === 'category' && (isOffline || error) ? (
              <TVTouchable
                style={styles.retryButton}
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry loading channels">
                <Text style={styles.retryText}>Retry</Text>
              </TVTouchable>
            ) : null}
          </View>
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 200, elevation: 200 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: 'rgba(11,16,32,0.98)',
    borderLeftWidth: 1,
    borderLeftColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerTitle: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentSelected: {
    backgroundColor: 'rgba(139,123,255,0.2)',
    borderColor: 'rgba(139,123,255,0.55)',
  },
  segmentText: { color: colors.fgMuted, fontSize: 12, fontWeight: '600' },
  segmentTextSelected: { color: colors.fg },
  listContent: { paddingVertical: 4 },
  skeletonList: { paddingVertical: 4 },
  skeletonRow: {
    height: 53,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  skeletonIcon: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonText: {
    width: '65%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  stateTitle: {
    color: colors.fgMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    minHeight: 44,
    marginTop: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,123,255,0.45)',
    backgroundColor: 'rgba(139,123,255,0.12)',
  },
  retryText: { color: colors.fg, fontSize: 13, fontWeight: '600' },
  channelItem: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  channelItemActive: { backgroundColor: 'rgba(139,123,255,0.15)' },
  channelItemTV: { height: TV_ITEM_HEIGHT },
  channelMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  channelIcon: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  channelIconPlaceholder: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  channelName: { flex: 1, color: colors.fgMuted, fontSize: 13 },
  channelNameActive: { color: colors.fg, fontWeight: '600' },
  nowPlaying: { width: 16, alignItems: 'center', marginLeft: 6 },
  nowPlayingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.indigo,
  },
  favoriteButton: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
