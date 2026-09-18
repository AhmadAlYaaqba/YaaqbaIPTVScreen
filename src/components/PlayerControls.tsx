// src/components/PlayerControls.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  LayoutChangeEvent,
  type AccessibilityActionEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import AppIcon from './AppIcon';

import FocusablePressable from '../tv/FocusablePressable';
import {
  formatPlaybackTime,
  getSeekTimeFromPosition,
} from '../utils/playbackTime';
import type { VideoContentMode } from '../types/player';

const IS_TV = Platform.isTV;

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
  brightnessOverlayStyle: any;
  brightnessFillStyle: any;
  onTogglePlayPause: () => void;
  onGoBack: () => void;
  onSeek?: (time: number) => void;
  onSeekInteractionStart?: () => void;
  onSeekInteractionEnd?: () => void;
  onRetry: () => void;
  fallbackActionLabel?: string;
  onFallbackAction?: () => void;
  onToggleChannelSwitcher?: () => void;
  onToggleVisibility: () => void;
  /**
   * TV: an overlay above the controls (the channel list) owns remote focus.
   * Controls are unfocusable meanwhile, and reclaim focus when it closes —
   * otherwise focus is left on the removed overlay and remote keys stop
   * reaching the player.
   */
  tvOverlayOpen?: boolean;
  contentMode: VideoContentMode;
  onCycleContentMode: () => void;
  onDoubleTap?: (x: number) => void;
  // Gesture callbacks
  onVerticalPanStart?: (x: number) => void;
  onVerticalPanMove?: (deltaY: number) => void;
  onVerticalPanEnd?: () => void;
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
  brightnessOverlayStyle,
  brightnessFillStyle,
  onTogglePlayPause,
  onGoBack,
  onSeek,
  onSeekInteractionStart,
  onSeekInteractionEnd,
  onRetry,
  fallbackActionLabel,
  onFallbackAction,
  onToggleChannelSwitcher,
  onToggleVisibility,
  tvOverlayOpen = false,
  contentMode,
  onCycleContentMode,
  onDoubleTap,
  onVerticalPanStart,
  onVerticalPanMove,
  onVerticalPanEnd,
}) => {
  // TV focus gating. Exactly one group is focusable at a time: the invisible
  // focus holder while controls are hidden, the controls while visible, or the
  // Retry / fallback buttons while an error is shown; nothing while an overlay
  // (the channel list) owns focus.
  const tvControlsFocusable = IS_TV ? visible && !tvOverlayOpen : undefined;
  const tvHolderFocusable = IS_TV
    ? !visible && !error && !tvOverlayOpen
    : undefined;
  const focusHolderRef = useRef<View>(null);
  const playButtonRef = useRef<View>(null);
  const wasOverlayOpenRef = useRef(tvOverlayOpen);

  // Android only routes remote keys to JS while some view holds focus. When
  // the overlay that owned focus unmounts, nothing does, and hasTVPreferredFocus
  // is a mount-time hint that does not move focus on an existing view, so ask
  // for it explicitly (react-native-tvos exposes requestTVFocus on View refs).
  useEffect(() => {
    const wasOpen = wasOverlayOpenRef.current;
    wasOverlayOpenRef.current = tvOverlayOpen;
    if (!IS_TV || !wasOpen || tvOverlayOpen || error) {
      return;
    }
    const target = visible ? playButtonRef.current : focusHolderRef.current;
    (target as unknown as { requestTVFocus?: () => void } | null)
      ?.requestTVFocus?.();
  }, [error, tvOverlayOpen, visible]);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);
  const seekBarWidth = useSharedValue(0);
  const playbackProgress = useSharedValue(0);
  const scrubProgress = useSharedValue(0);
  const isScrubbing = useSharedValue(false);
  const [showContentModeLabel, setShowContentModeLabel] = useState(false);
  const contentModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (contentModeTimerRef.current) {
        clearTimeout(contentModeTimerRef.current);
      }
    },
    [],
  );

  const handleCycleContentMode = useCallback(() => {
    onCycleContentMode();
    setShowContentModeLabel(true);
    if (contentModeTimerRef.current) {
      clearTimeout(contentModeTimerRef.current);
    }
    contentModeTimerRef.current = setTimeout(
      () => setShowContentModeLabel(false),
      1600,
    );
  }, [onCycleContentMode]);

  const onSeekBarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      seekBarWidth.set(event.nativeEvent.layout.width);
    },
    [seekBarWidth],
  );

  useEffect(() => {
    playbackProgress.set(
      duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0,
    );
  }, [currentTime, duration, playbackProgress]);

  const commitSeekPosition = useCallback(
    (x: number, width: number) => {
      const nextTime = getSeekTimeFromPosition(x, width, duration);
      if (nextTime !== null) onSeek?.(nextTime);
    },
    [duration, onSeek],
  );

  const seekGesture = useMemo(() => {
    const updateFromX = (x: number) => {
      'worklet';
      const width = seekBarWidth.get();
      if (width > 0) {
        scrubProgress.set(Math.max(0, Math.min(1, x / width)));
      }
    };

    const pan = Gesture.Pan()
      .enabled(duration > 0 && Boolean(onSeek))
      .minDistance(4)
      .onStart(event => {
        isScrubbing.set(true);
        updateFromX(event.x);
        if (onSeekInteractionStart) {
          runOnJS(onSeekInteractionStart)();
        }
      })
      .onUpdate(event => {
        updateFromX(event.x);
      })
      .onEnd(event => {
        runOnJS(commitSeekPosition)(event.x, seekBarWidth.get());
      })
      .onFinalize(() => {
        isScrubbing.set(false);
        if (onSeekInteractionEnd) {
          runOnJS(onSeekInteractionEnd)();
        }
      });

    const tap = Gesture.Tap()
      .enabled(duration > 0 && Boolean(onSeek))
      .maxDuration(350)
      .onEnd((event, success) => {
        if (!success) return;
        updateFromX(event.x);
        runOnJS(commitSeekPosition)(event.x, seekBarWidth.get());
      });

    return Gesture.Race(pan, tap);
  }, [
    commitSeekPosition,
    duration,
    isScrubbing,
    onSeek,
    onSeekInteractionEnd,
    onSeekInteractionStart,
    scrubProgress,
    seekBarWidth,
  ]);

  const displayedProgress = useDerivedValue(() =>
    isScrubbing.get() ? scrubProgress.get() : playbackProgress.get(),
  );
  const progressFillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: displayedProgress.get() }],
  }));
  const seekThumbStyle = useAnimatedStyle(() => {
    const width = seekBarWidth.get();
    const position = displayedProgress.get() * width;
    return {
      transform: [
        {
          translateX: Math.max(
            0,
            Math.min(Math.max(0, width - 14), position - 7),
          ),
        },
      ],
    };
  });

  const remainingTime = Math.max(0, duration - currentTime);
  const accessibilityProgress =
    duration > 0 ? Math.max(0, Math.min(duration, currentTime)) : 0;
  const handleSeekAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (!onSeek || duration <= 0) return;
      const delta = event.nativeEvent.actionName === 'decrement' ? -10 : 10;
      onSeek(Math.max(0, Math.min(duration, accessibilityProgress + delta)));
    },
    [accessibilityProgress, duration, onSeek],
  );

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
  }, [error, isReconnecting, opacity, translateY, visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const surfaceGesture = useMemo(() => {
    const doubleTap = Gesture.Tap()
      .enabled(!visible && !!onDoubleTap)
      .numberOfTaps(2)
      .maxDelay(250)
      .onEnd((event, success) => {
        if (success && onDoubleTap) {
          runOnJS(onDoubleTap)(event.x);
        }
      });
    const verticalPan = Gesture.Pan()
      .enabled(!visible)
      .minDistance(12)
      .onStart(event => {
        if (onVerticalPanStart) {
          runOnJS(onVerticalPanStart)(event.x);
        }
      })
      .onUpdate(event => {
        if (onVerticalPanMove) {
          runOnJS(onVerticalPanMove)(event.translationY);
        }
      })
      .onFinalize(() => {
        if (onVerticalPanEnd) {
          runOnJS(onVerticalPanEnd)();
        }
      });
    const singleTap = Gesture.Tap()
      .enabled(!visible)
      .numberOfTaps(1)
      .onEnd((_event, success) => {
        if (success) runOnJS(onToggleVisibility)();
      });
    return Gesture.Exclusive(doubleTap, verticalPan, singleTap);
  }, [
    onDoubleTap,
    onToggleVisibility,
    onVerticalPanEnd,
    onVerticalPanMove,
    onVerticalPanStart,
    visible,
  ]);

  return (
    <>
      {/*
        Transparent touch zone — ONLY active when controls are hidden.
        When controls are visible, this becomes invisible to touches,
        so buttons (pause, back, seek) can be tapped directly.
      */}
      <GestureDetector gesture={surfaceGesture}>
        <View
          style={styles.touchZone}
          pointerEvents={visible ? 'none' : 'auto'}
        />
      </GestureDetector>

      {/* Visual brightness overlay — darkens the video when brightness < 1 */}
      <Animated.View
        style={[styles.brightnessOverlay, brightnessOverlayStyle]}
        pointerEvents="none"
      />

      {/* Brightness indicator UI (non-interactive) */}
      {showBrightnessIndicator && (
        <Animated.View
          style={[styles.brightnessContainer, brightnessIndicatorStyle]}
          pointerEvents="none">
          <AppIcon
            name={brightness > 0.5 ? 'sun' : 'moon'}
            size={20}
            color="#fff"
          />
          <View style={styles.brightnessBarBg}>
            <Animated.View
              style={[styles.brightnessBarFill, brightnessFillStyle]}
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
        <View
          style={styles.errorOverlay}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive">
          <AppIcon name="exclamation-triangle" size={36} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorActions}>
            <FocusablePressable
              style={styles.retryButton}
              onPress={onRetry}
              hasTVPreferredFocus={IS_TV}
              accessibilityRole="button"
              accessibilityLabel="Retry playback">
              <AppIcon name="redo" size={14} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </FocusablePressable>
            {fallbackActionLabel && onFallbackAction ? (
              <FocusablePressable
                style={[styles.retryButton, styles.fallbackButton]}
                onPress={onFallbackAction}
                accessibilityRole="button"
                accessibilityLabel={fallbackActionLabel}>
                <AppIcon name="play-circle" size={14} color="#fff" />
                <Text style={styles.retryText}>{fallbackActionLabel}</Text>
              </FocusablePressable>
            ) : null}
          </View>
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
        {/*
          TV: this is the focus holder while controls are hidden. Android only
          routes remote keys into React when a view inside it has focus, and
          Select on it reveals the controls. Hidden buttons are unfocusable so
          focus never lands on something invisible. While an error is shown,
          its Retry / switch-player buttons hold focus instead.
        */}
        <Pressable
          ref={focusHolderRef}
          onPress={onToggleVisibility}
          style={StyleSheet.absoluteFill}
          focusable={tvHolderFocusable}
          hasTVPreferredFocus={tvHolderFocusable === true}
          accessibilityRole="button"
          accessibilityLabel="Hide playback controls"
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <FocusablePressable
            onPress={onGoBack}
            style={styles.backButton}
            focusable={tvControlsFocusable}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close player">
            <AppIcon name="arrow-left" size={18} color="#fff" />
          </FocusablePressable>
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
          <View style={styles.topRight}>
            <FocusablePressable
              onPress={handleCycleContentMode}
              style={styles.contentModeButton}
              focusable={tvControlsFocusable}
              accessibilityRole="button"
              accessibilityLabel={`Video aspect ratio: ${contentMode}. Change aspect ratio`}>
              <AppIcon name="expand-arrows-alt" size={17} color="#fff" />
            </FocusablePressable>
            {showContentModeLabel ? (
              <View style={styles.contentModeLabel} pointerEvents="none">
                <Text style={styles.contentModeText}>
                  {contentMode === 'fit'
                    ? 'Fit'
                    : contentMode === 'crop'
                    ? 'Crop'
                    : 'Stretch'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Center controls */}
        <View style={styles.centerControls} pointerEvents="box-none">
          {!isLive && (
            <FocusablePressable
              onPress={() => onSeek?.(Math.max(0, currentTime - 10))}
              style={styles.seekButton}
              focusable={tvControlsFocusable}
              accessibilityRole="button"
              accessibilityLabel="Go back 10 seconds">
              <AppIcon name="backward" size={20} color="#fff" />
            </FocusablePressable>
          )}
          <FocusablePressable
            ref={playButtonRef}
            onPress={onTogglePlayPause}
            style={styles.playButton}
            focusable={tvControlsFocusable}
            hasTVPreferredFocus={tvControlsFocusable === true && !error}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Play' : 'Pause'}
            accessibilityState={{ selected: !isPaused }}>
            <AppIcon
              name={isPaused ? 'play' : 'pause'}
              size={24}
              color="#fff"
            />
          </FocusablePressable>
          {!isLive && (
            <FocusablePressable
              onPress={() => onSeek?.(Math.min(duration, currentTime + 10))}
              style={styles.seekButton}
              focusable={tvControlsFocusable}
              accessibilityRole="button"
              accessibilityLabel="Go forward 10 seconds">
              <AppIcon name="forward" size={20} color="#fff" />
            </FocusablePressable>
          )}
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {!isLive && duration > 0 && (
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>
                {formatPlaybackTime(currentTime)}
              </Text>
              <GestureDetector gesture={seekGesture}>
                <View
                  style={styles.seekBarTouchTarget}
                  onLayout={onSeekBarLayout}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel="Playback position"
                  accessibilityHint="Swipe up or down to move by 10 seconds"
                  accessibilityActions={[
                    { name: 'increment', label: 'Forward 10 seconds' },
                    { name: 'decrement', label: 'Back 10 seconds' },
                  ]}
                  accessibilityValue={{
                    min: 0,
                    max: Math.round(duration),
                    now: Math.round(accessibilityProgress),
                    text: `${formatPlaybackTime(
                      accessibilityProgress,
                    )} elapsed, ${formatPlaybackTime(remainingTime)} remaining`,
                  }}
                  onAccessibilityAction={handleSeekAccessibilityAction}>
                  <View style={styles.progressBarBg}>
                    <Animated.View
                      style={[styles.progressBarFill, progressFillStyle]}
                    />
                  </View>
                  <Animated.View style={[styles.seekThumb, seekThumbStyle]} />
                </View>
              </GestureDetector>
              <Text style={[styles.timeText, styles.remainingTimeText]}>
                −{formatPlaybackTime(remainingTime)}
              </Text>
            </View>
          )}
          {isLive && onToggleChannelSwitcher && (
            <FocusablePressable
              onPress={onToggleChannelSwitcher}
              style={styles.channelSwitchButton}
              focusable={tvControlsFocusable}
              accessibilityRole="button"
              accessibilityLabel="Open channel list">
              <AppIcon name="list" size={16} color="#fff" />
              <Text style={styles.channelSwitchText}>Channels</Text>
            </FocusablePressable>
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
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: 'transparent',
  },
  // Visual brightness overlay — darkens the screen
  brightnessOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'black',
    zIndex: 2,
  },
  controlsContainer: {
    ...StyleSheet.absoluteFill,
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
    width: 44,
    position: 'relative',
  },
  contentModeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentModeLabel: {
    position: 'absolute',
    right: 0,
    top: 50,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(5,7,14,0.9)',
    alignItems: 'center',
  },
  contentModeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
    height: 48,
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
    width: '100%',
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 2,
    transformOrigin: 'left',
  },
  seekThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4A90E2',
    top: '50%',
    marginTop: -7,
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
  remainingTimeText: {
    textAlign: 'right',
  },
  channelSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
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
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
    transformOrigin: 'bottom',
  },
  brightnessText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  reconnectOverlay: {
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
    minHeight: 44,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fallbackButton: {
    backgroundColor: '#7C3AED',
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
