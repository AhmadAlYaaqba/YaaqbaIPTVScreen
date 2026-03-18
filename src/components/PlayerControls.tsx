// src/components/PlayerControls.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Dimensions,
    PanResponder,
    LayoutChangeEvent,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlayerControlsProps {
    visible: boolean;
    channelName?: string;
    isLive: boolean;
    isPaused: boolean;
    isBuffering: boolean;
    isReconnecting: boolean;
    reconnectAttempt: number;
    maxRetries: number;
    error: string | null;
    currentTime: number;
    duration: number;
    brightness: number;
    showBrightnessIndicator: boolean;
    brightnessIndicatorStyle: any;
    onTogglePlayPause: () => void;
    onGoBack: () => void;
    onSeek?: (time: number) => void;
    onRetry: () => void;
    onToggleChannelSwitcher?: () => void;
    onToggleVisibility: () => void;
    // Gesture callbacks
    onVerticalPanStart?: (x: number) => void;
    onVerticalPanMove?: (deltaY: number) => void;
    onVerticalPanEnd?: () => void;
}

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s
            .toString()
            .padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
    visible,
    channelName,
    isLive,
    isPaused,
    isBuffering,
    isReconnecting,
    reconnectAttempt,
    maxRetries,
    error,
    currentTime,
    duration,
    brightness,
    showBrightnessIndicator,
    brightnessIndicatorStyle,
    onTogglePlayPause,
    onGoBack,
    onSeek,
    onRetry,
    onToggleChannelSwitcher,
    onToggleVisibility,
    onVerticalPanStart,
    onVerticalPanMove,
    onVerticalPanEnd,
}) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(-10);

    // Track pan state (for brightness gesture on hidden controls)
    const isPanning = useRef(false);
    const panStart = useRef<{ x: number; y: number } | null>(null);

    // --- Seekbar state ---
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekTime, setSeekTime] = useState(0);
    const seekBarWidth = useRef(0);
    const seekBarPageX = useRef(0);

    const onSeekBarLayout = useCallback((event: LayoutChangeEvent) => {
        seekBarWidth.current = event.nativeEvent.layout.width;
        // Also measure pageX for accurate touch position
        event.target?.measure?.((_x: number, _y: number, _w: number, _h: number, pageX: number) => {
            if (pageX !== undefined) {
                seekBarPageX.current = pageX;
            }
        });
    }, []);

    // Use refs so PanResponder callbacks always read the latest duration & onSeek
    const durationRef = useRef(duration);
    const onSeekRef = useRef(onSeek);
    durationRef.current = duration;
    onSeekRef.current = onSeek;

    const seekPanResponderLatest = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (evt) => {
                const touchX = evt.nativeEvent.locationX;
                const dur = durationRef.current;
                if (seekBarWidth.current > 0 && dur > 0) {
                    const time = Math.max(0, Math.min(dur, (touchX / seekBarWidth.current) * dur));
                    setIsSeeking(true);
                    setSeekTime(time);
                }
            },
            onPanResponderMove: (evt) => {
                const touchX = evt.nativeEvent.locationX;
                const dur = durationRef.current;
                if (seekBarWidth.current > 0 && dur > 0) {
                    const time = Math.max(0, Math.min(dur, (touchX / seekBarWidth.current) * dur));
                    setSeekTime(time);
                }
            },
            onPanResponderRelease: (evt) => {
                const touchX = evt.nativeEvent.locationX;
                const dur = durationRef.current;
                if (seekBarWidth.current > 0 && dur > 0) {
                    const time = Math.max(0, Math.min(dur, (touchX / seekBarWidth.current) * dur));
                    onSeekRef.current?.(time);
                }
                setIsSeeking(false);
            },
            onPanResponderTerminate: () => {
                setIsSeeking(false);
            },
        }),
    ).current;

    useEffect(() => {
        if (visible || error || isReconnecting) {
            opacity.value = withTiming(1, {
                duration: 200,
                easing: Easing.out(Easing.cubic),
            });
            translateY.value = withTiming(0, { duration: 200 });
        } else {
            opacity.value = withTiming(0, { duration: 250 });
            translateY.value = withTiming(-10, { duration: 250 });
        }
    }, [visible, error, isReconnecting]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    // Use seekTime while dragging, otherwise use currentTime
    const displayTime = isSeeking ? seekTime : currentTime;
    const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

    // PanResponder for the transparent touch zone (ONLY active when controls hidden)
    // Handles: tap → show controls, vertical pan → brightness
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_evt, gs) => Math.abs(gs.dy) > 10,
            onPanResponderGrant: evt => {
                const { locationX, locationY } = evt.nativeEvent;
                panStart.current = { x: locationX, y: locationY };
                isPanning.current = false;
            },
            onPanResponderMove: (_evt, gs) => {
                if (!panStart.current) return;
                if (!isPanning.current && Math.abs(gs.dy) > 15) {
                    isPanning.current = true;
                    onVerticalPanStart?.(panStart.current.x);
                }
                if (isPanning.current) {
                    onVerticalPanMove?.(gs.dy);
                }
            },
            onPanResponderRelease: () => {
                if (isPanning.current) {
                    onVerticalPanEnd?.();
                } else {
                    onToggleVisibility();
                }
                isPanning.current = false;
                panStart.current = null;
            },
            onPanResponderTerminate: () => {
                if (isPanning.current) onVerticalPanEnd?.();
                isPanning.current = false;
                panStart.current = null;
            },
        }),
    ).current;

    return (
        <>
            {/*
        Transparent touch zone — ONLY active when controls are hidden.
        When controls are visible, this becomes invisible to touches,
        so buttons (pause, back, seek) can be tapped directly.
      */}
            <View
                style={styles.touchZone}
                pointerEvents={visible ? 'none' : 'auto'}
                {...panResponder.panHandlers}
            />

            {/* Visual brightness overlay — darkens the video when brightness < 1 */}
            <View
                style={[
                    styles.brightnessOverlay,
                    { opacity: Math.max(0, 1 - brightness) },
                ]}
                pointerEvents="none"
            />

            {/* Brightness indicator UI (non-interactive) */}
            {showBrightnessIndicator && (
                <Animated.View
                    style={[styles.brightnessContainer, brightnessIndicatorStyle]}
                    pointerEvents="none">
                    <FontAwesome5
                        name={brightness > 0.5 ? 'sun' : 'moon'}
                        size={20}
                        color="#fff"
                    />
                    <View style={styles.brightnessBarBg}>
                        <View
                            style={[
                                styles.brightnessBarFill,
                                { height: `${brightness * 100}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.brightnessText}>
                        {Math.round(brightness * 100)}%
                    </Text>
                </Animated.View>
            )}

            {/* Reconnecting overlay (non-interactive) */}
            {isReconnecting && !error && (
                <View style={styles.reconnectOverlay} pointerEvents="none">
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.reconnectText}>
                        Reconnecting... ({reconnectAttempt}/{maxRetries})
                    </Text>
                </View>
            )}

            {/* Error overlay (interactive — retry button) */}
            {error && (
                <View style={styles.errorOverlay}>
                    <FontAwesome5 name="exclamation-triangle" size={36} color="#FF6B6B" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                        <FontAwesome5 name="redo" size={14} color="#fff" />
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Buffering indicator (non-interactive) */}
            {isBuffering && !isReconnecting && !error && (
                <View style={styles.bufferingOverlay} pointerEvents="none">
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            )}

            {/* Controls overlay */}
            <Animated.View
                style={[styles.controlsContainer, containerStyle]}
                pointerEvents={visible ? 'box-none' : 'none'}>
                {/*
          Background tap target — fills gaps between buttons.
          Tapping empty areas hides controls.
        */}
                <TouchableWithoutFeedback onPress={onToggleVisibility}>
                    <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>

                {/* Top bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity
                        onPress={onGoBack}
                        style={styles.backButton}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <FontAwesome5 name="arrow-left" size={18} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.titleContainer}>
                        <Text style={styles.channelName} numberOfLines={1}>
                            {channelName || ''}
                        </Text>
                        {isLive && (
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.topRight} />
                </View>

                {/* Center controls */}
                <View style={styles.centerControls} pointerEvents="box-none">
                    {!isLive && (
                        <TouchableOpacity
                            onPress={() => onSeek?.(Math.max(0, currentTime - 10))}
                            style={styles.seekButton}>
                            <FontAwesome5 name="backward" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={onTogglePlayPause}
                        style={styles.playButton}>
                        <FontAwesome5
                            name={isPaused ? 'play' : 'pause'}
                            size={24}
                            color="#fff"
                        />
                    </TouchableOpacity>
                    {!isLive && (
                        <TouchableOpacity
                            onPress={() => onSeek?.(Math.min(duration, currentTime + 10))}
                            style={styles.seekButton}>
                            <FontAwesome5 name="forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bottom bar */}
                <View style={styles.bottomBar}>
                    {!isLive && duration > 0 && (
                        <View style={styles.progressContainer}>
                            <Text style={styles.timeText}>{formatTime(displayTime)}</Text>
                            <View
                                style={styles.seekBarTouchTarget}
                                onLayout={onSeekBarLayout}
                                {...seekPanResponderLatest.panHandlers}
                            >
                                <View style={styles.progressBarBg}>
                                    <View
                                        style={[styles.progressBarFill, { width: `${progress}%` }]}
                                    />
                                </View>
                                {/* Seek thumb */}
                                <View
                                    style={[
                                        styles.seekThumb,
                                        { left: `${progress}%` },
                                    ]}
                                />
                            </View>
                            <Text style={styles.timeText}>{formatTime(duration)}</Text>
                        </View>
                    )}
                    {isLive && onToggleChannelSwitcher && (
                        <TouchableOpacity
                            onPress={onToggleChannelSwitcher}
                            style={styles.channelSwitchButton}>
                            <FontAwesome5 name="list" size={16} color="#fff" />
                            <Text style={styles.channelSwitchText}>Channels</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        </>
    );
};

export default React.memo(PlayerControls);

const styles = StyleSheet.create({
    // Transparent touch zone — only active when controls hidden
    touchZone: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        backgroundColor: 'transparent',
    },
    // Visual brightness overlay — darkens the screen
    brightnessOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'black',
        zIndex: 2,
    },
    controlsContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        zIndex: 40,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
    },
    channelName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        flexShrink: 1,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E53935',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginLeft: 10,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
        marginRight: 4,
    },
    liveText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    topRight: {
        width: 40,
    },
    centerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
    },
    playButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    seekButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomBar: {
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    seekBarTouchTarget: {
        flex: 1,
        height: 40,
        justifyContent: 'center',
        marginHorizontal: 10,
        position: 'relative',
    },
    progressBarBg: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#4A90E2',
        borderRadius: 2,
    },
    seekThumb: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4A90E2',
        top: '50%',
        marginTop: -7,
        marginLeft: -7,
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    timeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
        minWidth: 45,
    },
    channelSwitchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    channelSwitchText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 8,
    },
    brightnessContainer: {
        position: 'absolute',
        left: 40,
        top: '20%',
        bottom: '20%',
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        paddingVertical: 12,
        zIndex: 55,
    },
    brightnessBarBg: {
        width: 4,
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        marginVertical: 8,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    brightnessBarFill: {
        width: '100%',
        backgroundColor: '#FFD700',
        borderRadius: 2,
    },
    brightnessText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    bufferingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    reconnectOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 15,
    },
    reconnectText: {
        color: '#fff',
        fontSize: 14,
        marginTop: 12,
        fontWeight: '500',
    },
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 60,
        paddingHorizontal: 40,
    },
    errorText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 20,
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4A90E2',
        borderRadius: 10,
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    retryText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
});
