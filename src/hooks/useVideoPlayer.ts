// src/hooks/useVideoPlayer.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { proxyStreamUrl } from '../utils/proxy';
import { buildLiveStreamUrl } from '../utils/xtream';

/**
 * Source fallback strategy:
 * 1. Original HLS URL (.m3u8) via proxy
 * 2. Same URL with .ts extension via proxy
 * 3. Direct stream URL (no proxy)
 */
export interface StreamSource {
    uri: string;
    type?: string;
    label: string;
}

export interface UseVideoPlayerOptions {
    originalStreamUrl: string;
    serverDomain: string;
    serverPort: string;
    username: string;
    password: string;
    streamId: string | number;
    isLive: boolean;
    useProxy?: boolean;
    autoReconnect?: boolean;
    maxRetries?: number;
    onSourceExhausted?: () => void;
}

export interface VideoPlayerState {
    currentSourceIndex: number;
    currentSource: StreamSource;
    isReconnecting: boolean;
    reconnectAttempt: number;
    isBuffering: boolean;
    error: string | null;
    isPaused: boolean;
    duration: number;
    currentTime: number;
    isCompleted: boolean;
}

function buildSources(
    originalStreamUrl: string,
    serverDomain: string,
    serverPort: string,
    username: string,
    password: string,
    streamId: string | number,
    useProxy: boolean,
): StreamSource[] {
    const sources: StreamSource[] = [
        {
            uri: originalStreamUrl,
            label: useProxy ? 'Original (proxied)' : 'Original (direct)',
        },
    ];

    if (streamId) {
        const baseHls = buildLiveStreamUrl({
            domain: serverDomain,
            port: serverPort,
            username,
            password,
            streamId,
            extension: 'm3u8',
        });
        const baseTs = buildLiveStreamUrl({
            domain: serverDomain,
            port: serverPort,
            username,
            password,
            streamId,
            extension: 'ts',
        });

        sources.push(
            {
                uri: proxyStreamUrl(baseTs, useProxy),
                type: 'mpegts',
                label: useProxy ? 'TS (proxied)' : 'TS (direct)',
            },
            {
                uri: baseHls,
                type: 'm3u8',
                label: 'HLS (direct)',
            },
        );
    }

    return sources;
}

// Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
function getBackoffDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 30000);
}

export function useVideoPlayer(options: UseVideoPlayerOptions) {
    const {
        originalStreamUrl,
        serverDomain,
        serverPort,
        username,
        password,
        streamId,
        isLive,
        useProxy: proxyEnabled = true,
        autoReconnect = true,
        maxRetries = 10,
        onSourceExhausted,
    } = options;

    const sources = isLive
        ? buildSources(originalStreamUrl, serverDomain, serverPort, username, password, streamId, proxyEnabled)
        : [{ uri: originalStreamUrl, type: undefined, label: 'Original' }];

    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);
    // Used to force re-mount the player on reconnect
    const [playerKey, setPlayerKey] = useState(0);

    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const bufferStallTimerRef = useRef<NodeJS.Timeout | null>(null);
    const videoRef = useRef<any>(null);
    const currentProgressRef = useRef(0);
    const appStateRef = useRef<AppStateStatus>('active');
    const prevStreamUrlRef = useRef(originalStreamUrl);

    // Reset state when stream URL changes (channel switch)
    if (originalStreamUrl !== prevStreamUrlRef.current) {
        prevStreamUrlRef.current = originalStreamUrl;
        // These will be applied on next render cycle
        setCurrentSourceIndex(0);
        setReconnectAttempt(0);
        setIsReconnecting(false);
        setError(null);
        setIsBuffering(false);
        setIsPaused(false);
        setDuration(0);
        setCurrentTime(0);
        setIsCompleted(false);
        setPlayerKey(k => k + 1);
    }

    const currentSource = sources[currentSourceIndex] || sources[0];

    // Clear reconnect timer
    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    // Clear buffer stall timer
    const clearBufferStallTimer = useCallback(() => {
        if (bufferStallTimerRef.current) {
            clearTimeout(bufferStallTimerRef.current);
            bufferStallTimerRef.current = null;
        }
    }, []);

    // Try next source in fallback chain
    const tryNextSource = useCallback(() => {
        const nextIndex = currentSourceIndex + 1;
        if (nextIndex < sources.length) {
            setCurrentSourceIndex(nextIndex);
            setError(null);
            setIsReconnecting(false);
            setReconnectAttempt(0);
            setPlayerKey(k => k + 1);
            if (__DEV__) console.log(`[Player] Switching to source: ${sources[nextIndex].label}`);
        } else {
            // All sources exhausted
            setError('All stream sources failed. Please try again later.');
            setIsReconnecting(false);
            onSourceExhausted?.();
        }
    }, [currentSourceIndex, sources, onSourceExhausted]);

    // Reconnect with exponential backoff
    const attemptReconnect = useCallback(() => {
        if (!autoReconnect || !isLive) return;

        if (reconnectAttempt >= maxRetries) {
            // Max retries for current source, try next source
            tryNextSource();
            return;
        }

        setIsReconnecting(true);
        const delay = getBackoffDelay(reconnectAttempt);
        if (__DEV__) console.log(`[Player] Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1}/${maxRetries})`);

        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
            setReconnectAttempt(prev => prev + 1);
            // Force re-mount the player component by changing the key
            setPlayerKey(k => k + 1);
            setIsReconnecting(false);
        }, delay);
    }, [
        autoReconnect,
        isLive,
        reconnectAttempt,
        maxRetries,
        currentSourceIndex,
        tryNextSource,
        clearReconnectTimer,
    ]);

    // Handle video error
    const onError = useCallback(
        (err: any) => {
            if (__DEV__) console.log('[Player] Error:', JSON.stringify(err));

            // On Android, detect BEHIND_LIVE_WINDOW and seek to live edge
            if (
                Platform.OS === 'android' &&
                err?.error?.errorString?.includes('BEHIND_LIVE_WINDOW')
            ) {
                if (__DEV__) console.log('[Player] Behind live window, seeking to live edge');
                videoRef.current?.seek(0); // seek to live edge
                return;
            }

            if (isLive && autoReconnect) {
                attemptReconnect();
            } else {
                // For VOD, just show the error
                setError(
                    err?.error?.errorString ||
                    err?.error?.message ||
                    'Playback error occurred',
                );
            }
        },
        [isLive, autoReconnect, attemptReconnect],
    );

    // Handle video load success
    const onLoad = useCallback(
        (data: any) => {
            if (__DEV__) console.log('[Player] Loaded:', data.duration);
            setDuration(data.duration || 0);
            setError(null);
            setIsReconnecting(false);
            setReconnectAttempt(0);
            setIsBuffering(false);
            clearBufferStallTimer();
        },
        [clearBufferStallTimer],
    );

    // Handle progress
    const onProgress = useCallback(
        (data: any) => {
            if (isLive) return;
            const ct = data.currentTime || 0;
            setCurrentTime(ct);
            currentProgressRef.current = ct;

            // Check completion (within last 5 seconds)
            if (duration > 0 && ct >= duration - 5) {
                setIsCompleted(true);
            }
        },
        [isLive, duration],
    );

    // Handle buffer state
    const onBuffer = useCallback(
        (data: { isBuffering: boolean }) => {
            setIsBuffering(data.isBuffering);

            if (data.isBuffering && isLive) {
                // Start stall detection timer — if buffering for >15s, attempt reconnect
                clearBufferStallTimer();
                bufferStallTimerRef.current = setTimeout(() => {
                    if (__DEV__) console.log('[Player] Buffer stall detected, attempting reconnect');
                    attemptReconnect();
                }, 15000);
            } else {
                clearBufferStallTimer();
            }
        },
        [isLive, attemptReconnect, clearBufferStallTimer],
    );

    // Toggle play/pause
    const togglePlayPause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

    // Seek
    const seek = useCallback((time: number) => {
        videoRef.current?.seek(time);
        setCurrentTime(time);
    }, []);

    // Manual retry
    const retry = useCallback(() => {
        setError(null);
        setIsReconnecting(false);
        setReconnectAttempt(0);
        setCurrentSourceIndex(0);
        setPlayerKey(k => k + 1);
    }, []);

    // AppState listener for reconnection on background → foreground
    useEffect(() => {
        const subscription = AppState.addEventListener(
            'change',
            (nextState: AppStateStatus) => {
                if (
                    appStateRef.current.match(/inactive|background/) &&
                    nextState === 'active' &&
                    isLive &&
                    autoReconnect
                ) {
                    if (__DEV__) console.log('[Player] App resumed, refreshing stream');
                    // Force re-mount the player
                    setPlayerKey(k => k + 1);
                    setReconnectAttempt(0);
                    setIsReconnecting(false);
                    setError(null);
                }
                appStateRef.current = nextState;
            },
        );

        return () => {
            subscription.remove();
            clearReconnectTimer();
            clearBufferStallTimer();
        };
    }, [isLive, autoReconnect]);

    // Platform-specific buffer config
    const bufferConfig = isLive
        ? Platform.select({
            android: {
                minBufferMs: 15000,
                maxBufferMs: 50000,
                bufferForPlaybackMs: 2500,
                bufferForPlaybackAfterRebufferMs: 5000,
                cacheSizeMB: 0,
                live: {
                    targetOffsetMs: 3000,
                },
            },
            ios: {
                minBufferMs: 15000,
                maxBufferMs: 30000,
                bufferForPlaybackMs: 2500,
                bufferForPlaybackAfterRebufferMs: 5000,
            },
        })
        : Platform.select({
            android: {
                minBufferMs: 15000,
                maxBufferMs: 50000,
                bufferForPlaybackMs: 2500,
                bufferForPlaybackAfterRebufferMs: 5000,
                cacheSizeMB: 200,
            },
            ios: {
                minBufferMs: 15000,
                maxBufferMs: 50000,
                bufferForPlaybackMs: 2500,
                bufferForPlaybackAfterRebufferMs: 5000,
            },
        });

    return {
        // Refs
        videoRef,
        currentProgressRef,

        // State
        currentSource,
        currentSourceIndex,
        isReconnecting,
        reconnectAttempt,
        maxRetries,
        isBuffering,
        error,
        isPaused,
        duration,
        currentTime,
        isCompleted,
        bufferConfig,
        sources,
        playerKey,

        // Actions
        onError,
        onLoad,
        onProgress,
        onBuffer,
        togglePlayPause,
        seek,
        retry,
        tryNextSource,
        setIsPaused,
        setDuration,
        setIsCompleted,
    };
}
