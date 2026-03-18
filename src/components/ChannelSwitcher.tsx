// src/components/ChannelSwitcher.tsx
import React, { useCallback, useEffect } from 'react';
import { proxyStreamUrl } from '../utils/proxy';
import { buildLiveStreamUrl } from '../utils/xtream';
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

interface Channel {
    stream_id: number;
    name: string;
    stream_icon?: string;
    icon?: string;
}

interface ChannelSwitcherProps {
    visible: boolean;
    channels: Channel[];
    activeStreamUrl: string;
    serverDomain: string;
    serverPort: string;
    username: string;
    password: string;
    useProxy: boolean;
    onSelectChannel: (streamUrl: string, channelName: string, streamId: string) => void;
    onClose: () => void;
}

const ChannelItem = React.memo(
    ({
        item,
        isActive,
        onPress,
    }: {
        item: Channel;
        isActive: boolean;
        onPress: () => void;
    }) => (
        <TouchableOpacity
            style={[styles.channelItem, isActive && styles.channelItemActive]}
            onPress={onPress}
            activeOpacity={0.7}>
            {item.stream_icon || item.icon ? (
                <Image
                    source={{ uri: item.stream_icon || item.icon }}
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
                numberOfLines={2}>
                {item.name}
            </Text>
            {isActive && (
                <View style={styles.nowPlaying}>
                    <View style={styles.nowPlayingDot} />
                </View>
            )}
        </TouchableOpacity>
    ),
);

const ChannelSwitcher: React.FC<ChannelSwitcherProps> = ({
    visible,
    channels,
    activeStreamUrl,
    serverDomain,
    serverPort,
    username,
    password,
    useProxy,
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
    }, [visible]);

    const panelStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const buildStreamUrl = useCallback(
        (streamId: number) => {
            const originalUrl = buildLiveStreamUrl({
                domain: serverDomain,
                port: serverPort,
                username,
                password,
                streamId,
            });
            return proxyStreamUrl(originalUrl, useProxy);
        },
        [serverDomain, serverPort, username, password, useProxy],
    );

    const renderItem = useCallback(
        ({ item }: { item: Channel }) => {
            const itemStreamUrl = buildStreamUrl(item.stream_id);
            const isActive = itemStreamUrl === activeStreamUrl;

            return (
                <ChannelItem
                    item={item}
                    isActive={isActive}
                    onPress={() => {
                        if (!isActive) {
                            onSelectChannel(
                                itemStreamUrl,
                                item.name,
                                String(item.stream_id),
                            );
                        }
                        onClose();
                    }}
                />
            );
        },
        [activeStreamUrl, buildStreamUrl, onSelectChannel, onClose],
    );

    const keyExtractor = useCallback(
        (item: Channel) => String(item.stream_id),
        [],
    );

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 200 }]}>
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

                {/* Channel list */}
                <FlatList
                    data={channels}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                />
            </Animated.View>
        </View>
    );
};

export default React.memo(ChannelSwitcher);

const styles = StyleSheet.create({
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
