// src/hooks/useVideoPlayer.ts
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import type { BufferConfig } from 'react-native-video';
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

export interface PlaybackDebugEntry {
    id: number;
    at: string;
    label: string;
    uri: string;
    sourceIndex: number;
    reconnectAttempt: number;
    status: 'requesting' | 'loaded' | 'failed';
    error?: string;
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

function getPlaybackErrorMessage(err: any): string {
    return (
        err?.error?.errorString ||
        err?.error?.message ||
        err?.message ||
        'Playback error occurred'
    );
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

    const sources = useMemo(
        () => (
            isLive
                ? buildSources(
                    originalStreamUrl,
                    serverDomain,
                    serverPort,
                    username,
                    password,
                    streamId,
                    proxyEnabled,
                )
                : [{ uri: originalStreamUrl, type: undefined, label: 'Original' }]
        ),
        [
            isLive,
            originalStreamUrl,
            serverDomain,
            serverPort,
            username,
            password,
            streamId,
            proxyEnabled,
        ],
    );

    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);
    const [lastFailureReason, setLastFailureReason] = useState<string | null>(null);
    const [debugEntries, setDebugEntries] = useState<PlaybackDebugEntry[]>([]);
    // Used to force re-mount the player on reconnect
    const [playerKey, setPlayerKey] = useState(0);

    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bufferStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentProgressRef = useRef(0);
    const appStateRef = useRef<AppStateStatus>('active');
    const prevStreamUrlRef = useRef(originalStreamUrl);
    const debugEntryIdRef = useRef(0);
    const lastRequestLogKeyRef = useRef('');

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
        setLastFailureReason(null);
        setDebugEntries([]);
        setPlayerKey(k => k + 1);
    }

    const currentSource = sources[currentSourceIndex] || sources[0];

    const pushDebugEntry = useCallback(
        (
            entry: Omit<PlaybackDebugEntry, 'id' | 'at'>,
        ) => {
            const nextEntry: PlaybackDebugEntry = {
                ...entry,
                id: ++debugEntryIdRef.current,
                at: new Date().toISOString(),
            };

            setDebugEntries(prev => [nextEntry, ...prev].slice(0, 8));
        },
        [],
    );

    useEffect(() => {
        if (!__DEV__ || !isLive || !currentSource?.uri) {
            return;
        }

        const requestLogKey = `${playerKey}:${currentSourceIndex}:${currentSource.uri}`;
        if (lastRequestLogKeyRef.current === requestLogKey) {
            return;
        }
        lastRequestLogKeyRef.current = requestLogKey;

        pushDebugEntry({
            label: currentSource.label,
            uri: currentSource.uri,
            sourceIndex: currentSourceIndex,
            reconnectAttempt,
            status: 'requesting',
        });
    }, [
        currentSource?.label,
        currentSource?.uri,
        currentSourceIndex,
        isLive,
        playerKey,
        pushDebugEntry,
        reconnectAttempt,
    ]);

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
            if (__DEV__) {
                console.log(`[Player] Switching to source: ${sources[nextIndex].label}`);
            }
        } else {
            // All sources exhausted
            setError('All stream sources failed. Please try again later.');
            setIsReconnecting(false);
            onSourceExhausted?.();
        }
    }, [currentSourceIndex, sources, onSourceExhausted]);

    // Reconnect with exponential backoff
    const attemptReconnect = useCallback(() => {
        if (!autoReconnect || !isLive) {
            return;
        }

        if (reconnectAttempt >= maxRetries) {
            // Max retries for current source, try next source
            tryNextSource();
            return;
        }

        setIsReconnecting(true);
        const delay = getBackoffDelay(reconnectAttempt);
        if (__DEV__) {
            console.log(`[Player] Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1}/${maxRetries})`);
        }

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
        tryNextSource,
        clearReconnectTimer,
    ]);

    // Handle video error
    const onError = useCallback(
        (err: any) => {
            if (__DEV__) {
                console.log('[Player] Error:', JSON.stringify(err));
            }
            const errorMessage = getPlaybackErrorMessage(err);
            setLastFailureReason(errorMessage);

            if (__DEV__ && currentSource?.uri) {
                pushDebugEntry({
                    label: currentSource.label,
                    uri: currentSource.uri,
                    sourceIndex: currentSourceIndex,
                    reconnectAttempt,
                    status: 'failed',
                    error: errorMessage,
                });
            }

            // On Android, recover by remounting the player at the live edge.
            if (
                Platform.OS === 'android' &&
                err?.error?.errorString?.includes('BEHIND_LIVE_WINDOW')
            ) {
                if (__DEV__) {
                    console.log('[Player] Behind live window, remounting player');
                }
                setReconnectAttempt(0);
                setIsReconnecting(false);
                setError(null);
                setPlayerKey(k => k + 1);
                return;
            }

            if (isLive && autoReconnect) {
                attemptReconnect();
            } else {
                // For VOD, just show the error
                setError(errorMessage);
            }
        },
        [
            isLive,
            autoReconnect,
            attemptReconnect,
            currentSource,
            currentSourceIndex,
            reconnectAttempt,
            pushDebugEntry,
        ],
    );

    // Handle video load success
    const onLoad = useCallback(
        (data: any) => {
            if (__DEV__) {
                console.log('[Player] Loaded:', data.duration);
            }
            setDuration(data.duration || 0);
            setError(null);
            setIsReconnecting(false);
            setReconnectAttempt(0);
            setIsBuffering(false);
            clearBufferStallTimer();

            if (__DEV__ && currentSource?.uri) {
                pushDebugEntry({
                    label: currentSource.label,
                    uri: currentSource.uri,
                    sourceIndex: currentSourceIndex,
                    reconnectAttempt,
                    status: 'loaded',
                });
            }
        },
        [clearBufferStallTimer, currentSource, currentSourceIndex, pushDebugEntry, reconnectAttempt],
    );

    // Handle progress
    const onProgress = useCallback(
        (data: any) => {
            if (isLive) {
                return;
            }
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
                    if (__DEV__) {
                        console.log('[Player] Buffer stall detected, attempting reconnect');
                    }
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
                    if (__DEV__) {
                        console.log('[Player] App resumed, refreshing stream');
                    }
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
    }, [isLive, autoReconnect, clearReconnectTimer, clearBufferStallTimer]);

    // Platform-specific buffer config
    const bufferConfig: BufferConfig | undefined =
        Platform.OS !== 'android'
            ? undefined
            : isLive
                ? {
                    minBufferMs: 15000,
                    maxBufferMs: 50000,
                    bufferForPlaybackMs: 2500,
                    bufferForPlaybackAfterRebufferMs: 5000,
                    backBufferDurationMs: 0,
                    cacheSizeMB: 0,
                    live: {
                        targetOffsetMs: 6000,
                        minOffsetMs: 4000,
                        maxOffsetMs: 10000,
                        minPlaybackSpeed: 0.97,
                        maxPlaybackSpeed: 1.03,
                    },
                }
                : {
                    minBufferMs: 15000,
                    maxBufferMs: 50000,
                    bufferForPlaybackMs: 2500,
                    bufferForPlaybackAfterRebufferMs: 5000,
                    cacheSizeMB: 200,
                };

    return {
        currentProgressRef,

        // State
        currentSource,
        currentSourceIndex,
        isReconnecting,
        reconnectAttempt,
        maxRetries,
        isBuffering,
        error,
        lastFailureReason,
        isPaused,
        duration,
        currentTime,
        isCompleted,
        bufferConfig,
        sources,
        playerKey,
        debugEntries,

        // Actions
        onError,
        onLoad,
        onProgress,
        onBuffer,
        togglePlayPause,
        retry,
        tryNextSource,
        setIsPaused,
        setDuration,
        setIsCompleted,
    };
}
