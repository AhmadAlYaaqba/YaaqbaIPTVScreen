// src/hooks/usePlayerGestures.ts
import { useRef, useCallback, useState } from 'react';
import { Dimensions } from 'react-native';
import {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Use landscape dimensions (player is always landscape)
const PLAYER_WIDTH = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);
const PLAYER_HEIGHT = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);

export interface UsePlayerGesturesOptions {
    isLive: boolean;
    duration: number;
    onSeek?: (time: number) => void;
    onBrightnessChange?: (level: number) => void;
}

export function usePlayerGestures(options: UsePlayerGesturesOptions) {
    const { isLive, duration, onSeek, onBrightnessChange } = options;

    // Brightness state (0-1, drives the visual overlay in PlayerControls)
    const [brightness, setBrightnessState] = useState(1.0); // 1.0 = full brightness
    const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);
    const brightnessStartRef = useRef(1.0);

    // Gesture tracking
    const gestureActiveRef = useRef(false);
    const gestureTypeRef = useRef<'brightness' | 'seek' | null>(null);

    // Animated values
    const brightnessOpacity = useSharedValue(0);
    const brightnessLevel = useSharedValue(1.0);

    // Set brightness (visual only — no system API, no permissions needed)
    const setScreenBrightness = useCallback(
        (level: number) => {
            const clamped = Math.max(0.05, Math.min(1, level));
            setBrightnessState(clamped);
            brightnessLevel.value = clamped;
            onBrightnessChange?.(clamped);
        },
        [onBrightnessChange],
    );

    // Handle vertical pan gesture (left side = brightness)
    const onVerticalPanStart = useCallback(
        (x: number) => {
            const isLeftSide = x < PLAYER_WIDTH / 2;
            if (isLeftSide) {
                gestureTypeRef.current = 'brightness';
                brightnessStartRef.current = brightness;
                brightnessOpacity.value = withTiming(1, { duration: 150 });
                setShowBrightnessIndicator(true);
            }
            gestureActiveRef.current = true;
        },
        [brightness],
    );

    const onVerticalPanMove = useCallback(
        (translationY: number) => {
            if (gestureTypeRef.current === 'brightness') {
                // Negative translationY = swipe up = increase brightness
                const delta = -translationY / (PLAYER_HEIGHT * 0.7);
                const newBrightness = Math.max(
                    0.05,
                    Math.min(1, brightnessStartRef.current + delta),
                );
                setScreenBrightness(newBrightness);
            }
        },
        [setScreenBrightness],
    );

    const onVerticalPanEnd = useCallback(() => {
        gestureActiveRef.current = false;
        gestureTypeRef.current = null;

        // Hide brightness indicator after delay
        brightnessOpacity.value = withDelay(
            500,
            withTiming(0, { duration: 300 }),
        );
        setTimeout(() => setShowBrightnessIndicator(false), 1000);
    }, []);

    // Double tap to seek ±10s (VOD only)
    const handleDoubleTap = useCallback(
        (x: number, currentTime: number) => {
            if (isLive || !onSeek) return;

            const isLeftSide = x < PLAYER_WIDTH / 2;
            const seekAmount = isLeftSide ? -10 : 10;
            const newTime = Math.max(0, Math.min(duration, currentTime + seekAmount));
            onSeek(newTime);
        },
        [isLive, duration, onSeek],
    );

    // Animated styles
    const brightnessIndicatorStyle = useAnimatedStyle(() => ({
        opacity: brightnessOpacity.value,
    }));

    return {
        brightness,
        showBrightnessIndicator,
        onVerticalPanStart,
        onVerticalPanMove,
        onVerticalPanEnd,
        handleDoubleTap,
        brightnessIndicatorStyle,
        brightnessLevel,
    };
}
