// src/components/ChannelSwitcher.tsx
import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Image,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CHANNEL_SKELETON_ITEMS = Array.from({ length: 10 }, (_, index) => index);

interface Channel {
    stream_id: number;
    name: string;
    stream_icon?: string;
    icon?: string;
    container_extension?: string;
}

interface ChannelSwitcherProps {
  visible: boolean;
  channels: Channel[];
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
  ) => void;
  onClose: () => void;
}

const ChannelItem = React.memo(
  ({
    streamId,
    name,
    thumbnail,
    extension,
    isActive,
    onSelect,
  }: {
    streamId: number;
    name: string;
    thumbnail?: string;
    extension?: string;
    isActive: boolean;
    onSelect: (
      streamId: number,
      name: string,
      thumbnail?: string,
      extension?: string,
    ) => void;
  }) => {
    const handlePress = useCallback(() => {
      onSelect(streamId, name, thumbnail, extension);
    }, [extension, name, onSelect, streamId, thumbnail]);

    return (
      <TouchableOpacity
        style={[styles.channelItem, isActive && styles.channelItemActive]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`${name}${isActive ? ', now playing' : ''}`}
      >
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={styles.channelIcon}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.channelIconPlaceholder}>
            <FontAwesome5 name="tv" size={14} color="#666" />
          </View>
        )}
        <Text
          style={[styles.channelName, isActive && styles.channelNameActive]}
          numberOfLines={2}
        >
          {name}
        </Text>
        {isActive && (
          <View style={styles.nowPlaying}>
            <View style={styles.nowPlayingDot} />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

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

const ChannelSwitcher: React.FC<ChannelSwitcherProps> = ({
  visible,
  channels,
  activeStreamId,
  isLoading,
  isOffline,
  error,
  onRetry,
  onSelectChannel,
  onClose,
}) => {
    const translateX = useSharedValue(PANEL_WIDTH);
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            translateX.value = withTiming(0, {
                duration: 250,
                easing: Easing.out(Easing.cubic),
            });
            backdropOpacity.value = withTiming(1, { duration: 200 });
        } else {
            translateX.value = withTiming(PANEL_WIDTH, {
                duration: 200,
                easing: Easing.in(Easing.cubic),
            });
            backdropOpacity.value = withTiming(0, { duration: 150 });
        }
    }, [backdropOpacity, translateX, visible]);

    const panelStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const handleSelect = useCallback(
      (
        streamId: number,
        name: string,
        thumbnail?: string,
        extension = 'm3u8',
      ) => {
        if (String(streamId) !== activeStreamId) {
          onSelectChannel(
            String(streamId),
            name,
            extension.replace(/^\./, '') || 'm3u8',
            thumbnail,
          );
        }
        onClose();
      },
      [activeStreamId, onClose, onSelectChannel],
    );

    const renderItem = useCallback(
      ({ item }: { item: Channel }) => (
        <ChannelItem
          streamId={item.stream_id}
          name={item.name}
          thumbnail={item.stream_icon || item.icon}
          extension={item.container_extension}
          isActive={String(item.stream_id) === activeStreamId}
          onSelect={handleSelect}
        />
      ),
      [activeStreamId, handleSelect],
    );

    const keyExtractor = useCallback(
        (item: Channel) => String(item.stream_id),
        [],
    );

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            {/* Backdrop */}
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.backdrop, backdropStyle]} />
            </TouchableWithoutFeedback>

            {/* Panel */}
            <Animated.View style={[styles.panel, panelStyle]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Channels</Text>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <FontAwesome5 name="times" size={16} color="#aaa" />
                    </TouchableOpacity>
                </View>

                {/* Cached channels remain usable while a refresh is in flight. */}
                {channels.length > 0 ? (
                  <FlatList
                    data={channels}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                    removeClippedSubviews
                  />
                ) : isLoading ? (
                  <ChannelListSkeleton />
                ) : (
                  <View style={styles.stateContainer}>
                    <FontAwesome5
                      name={isOffline ? 'wifi' : error ? 'exclamation-circle' : 'inbox'}
                      size={28}
                      color={error ? '#ff6b6b' : '#777'}
                    />
                    <Text style={styles.stateTitle}>
                      {isOffline
                        ? 'Channels unavailable offline'
                        : error
                          ? 'Could not load channels'
                          : 'No channels in this category'}
                    </Text>
                    {(isOffline || error) && (
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={onRetry}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading channels"
                      >
                        <Text style={styles.retryText}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
            </Animated.View>
        </View>
    );
};

export default React.memo(ChannelSwitcher);

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 200,
        elevation: 200,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    panel: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        backgroundColor: 'rgba(20,20,20,0.95)',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    listContent: {
        paddingVertical: 4,
    },
    skeletonList: {
        paddingVertical: 4,
    },
    skeletonRow: {
        height: 53,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
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
        color: '#bbb',
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        marginTop: 12,
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 9,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(74,144,226,0.45)',
        backgroundColor: 'rgba(74,144,226,0.12)',
    },
    retryText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    channelItemActive: {
        backgroundColor: 'rgba(74,144,226,0.15)',
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
        borderRadius: 4,
        marginRight: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelName: {
        flex: 1,
        color: '#ccc',
        fontSize: 13,
        fontWeight: '500',
    },
    channelNameActive: {
        color: '#4A90E2',
        fontWeight: '700',
    },
    nowPlaying: {
        marginLeft: 6,
    },
    nowPlayingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4A90E2',
    },
});
