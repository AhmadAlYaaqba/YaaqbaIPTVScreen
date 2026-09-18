import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import type { BufferConfig } from 'react-native-video';

import type { PlaybackRequest, PlayerEngine } from '../types/player';
import {
  buildPlaybackSources,
  decidePlaybackFailure,
  getPlaybackResumePosition,
  PLAYBACK_RETRY_DELAYS_MS,
  type PlaybackConnection,
} from '../utils/playbackSources';
import { getSanitizedPlaybackError } from '../utils/playbackDiagnostics';

// IPTV manifests commonly use 6–10 second segments. Give a live stream enough
// time to recover across two segments before replacing a source that may still
// be decoding successfully.
export const LIVE_STALL_TIMEOUT_MS = 20000;
export const LIVE_ERROR_RECOVERY_GRACE_MS = 3000;
export const BUFFERING_INDICATOR_DELAY_MS = 600;
export const BUFFERING_ACTIVITY_GRACE_MS = 1500;
const PLAYBACK_PROGRESS_EPSILON_SECONDS = 0.05;

export interface UseVideoPlayerOptions {
  request: PlaybackRequest;
  connection: PlaybackConnection;
  playlistId: string | null;
  playerEngine: PlayerEngine;
  isOffline: boolean;
  useProxy?: boolean;
  autoReconnect?: boolean;
  onSourceExhausted?: () => void;
}

export interface PlaybackDebugEntry {
  id: number;
  at: string;
  label: string;
  engine: PlayerEngine;
  platform: string;
  mediaKind: PlaybackRequest['kind'];
  extension: string;
  delivery: 'proxy' | 'direct';
  sourceAttempt: number;
  sourceCount: number;
  retryAttempt: number;
  status: 'requesting' | 'loaded' | 'failed';
  error?: string;
  errorCode?: string;
}

function getInitialProgress(request: PlaybackRequest): number {
  return request.kind === 'live' ? 0 : request.resume?.progress ?? 0;
}

function getInitialDuration(request: PlaybackRequest): number {
  if (request.kind === 'live') return 0;
  const duration = request.resume?.totalDuration ?? request.expectedDuration;
  return duration && Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export function useVideoPlayer(options: UseVideoPlayerOptions) {
  const {
    request,
    connection,
    playlistId,
    playerEngine,
    isOffline,
    useProxy = true,
    autoReconnect = true,
    onSourceExhausted,
  } = options;

  const isLive = request.kind === 'live';
  const sources = useMemo(
    () => buildPlaybackSources(request, connection, useProxy),
    [connection, request, useProxy],
  );
  const requestKey = `${playlistId ?? 'none'}:${request.kind}:${
    request.streamId
  }:${request.extension}:${useProxy}:${playerEngine}`;
  const initialProgress = getInitialProgress(request);
  const initialDuration = getInitialDuration(request);

  const [activeRequestKey, setActiveRequestKey] = useState(requestKey);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(initialDuration);
  // Read by onProgress so its identity does not churn on duration updates.
  const durationRef = useRef(duration);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  const [currentTime, setCurrentTime] = useState(initialProgress);
  const [isCompleted, setIsCompleted] = useState(false);
  const [lastFailureReason, setLastFailureReason] = useState<string | null>(
    null,
  );
  const [debugEntries, setDebugEntries] = useState<PlaybackDebugEntry[]>([]);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const bufferingIndicatorTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const liveErrorGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentProgressRef = useRef(initialProgress);
  const appStateRef = useRef<AppStateStatus>(
    typeof AppState.currentState === 'string'
      ? AppState.currentState
      : 'active',
  );
  const sourceIndexRef = useRef(0);
  const retriesUsedRef = useRef(0);
  const isOfflineRef = useRef(isOffline);
  const wasOfflineRef = useRef(isOffline);
  const cycleExhaustedRef = useRef(false);
  const debugEntryIdRef = useRef(0);
  const lastRequestLogKeyRef = useRef('');
  const lastProgressSecondRef = useRef(Math.floor(initialProgress));
  const loadStartedAtRef = useRef(Date.now());
  const completedSourceTokenRef = useRef<string | null>(null);
  const lastMediaTimeRef = useRef<number | null>(null);
  const lastPlaybackActivityAtRef = useRef(0);
  const hasConfirmedPlaybackRef = useRef(false);
  const liveStallWatchActiveRef = useRef(false);
  const resumeRecoveryOnForegroundRef = useRef(false);

  const requestIsCurrent = activeRequestKey === requestKey;
  const effectiveSourceIndex = requestIsCurrent ? currentSourceIndex : 0;
  const effectiveCurrentTime = requestIsCurrent ? currentTime : initialProgress;
  const currentSource = sources[effectiveSourceIndex] ?? sources[0];
  const sourceToken = `${requestKey}:${sourceRevision}`;
  // Mirrors for event callbacks. Written in an effect, not during render:
  // React 19 may discard or double-invoke renders.
  useEffect(() => {
    sourceIndexRef.current = effectiveSourceIndex;
    isOfflineRef.current = isOffline;
  }, [effectiveSourceIndex, isOffline]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearBufferStallTimer = useCallback(() => {
    if (bufferStallTimerRef.current) {
      clearTimeout(bufferStallTimerRef.current);
      bufferStallTimerRef.current = null;
    }
  }, []);

  const clearBufferingIndicatorTimer = useCallback(() => {
    if (bufferingIndicatorTimerRef.current) {
      clearTimeout(bufferingIndicatorTimerRef.current);
      bufferingIndicatorTimerRef.current = null;
    }
  }, []);

  const clearLiveErrorGraceTimer = useCallback(() => {
    if (liveErrorGraceTimerRef.current) {
      clearTimeout(liveErrorGraceTimerRef.current);
      liveErrorGraceTimerRef.current = null;
    }
  }, []);

  const resetSourceHealth = useCallback(() => {
    clearBufferStallTimer();
    clearBufferingIndicatorTimer();
    clearLiveErrorGraceTimer();
    liveStallWatchActiveRef.current = false;
    hasConfirmedPlaybackRef.current = false;
    lastMediaTimeRef.current = null;
    lastPlaybackActivityAtRef.current = 0;
  }, [
    clearBufferStallTimer,
    clearBufferingIndicatorTimer,
    clearLiveErrorGraceTimer,
  ]);

  const scheduleBufferingIndicator = useCallback(() => {
    if (bufferingIndicatorTimerRef.current || isOfflineRef.current) {
      return;
    }

    const showWhenPlaybackIsActuallyIdle = () => {
      const elapsedSinceProgress =
        Date.now() - lastPlaybackActivityAtRef.current;
      if (
        hasConfirmedPlaybackRef.current &&
        elapsedSinceProgress < BUFFERING_ACTIVITY_GRACE_MS
      ) {
        bufferingIndicatorTimerRef.current = setTimeout(
          showWhenPlaybackIsActuallyIdle,
          BUFFERING_ACTIVITY_GRACE_MS - elapsedSinceProgress,
        );
        return;
      }

      bufferingIndicatorTimerRef.current = null;
      if (!isOfflineRef.current) {
        setIsBuffering(true);
      }
    };

    bufferingIndicatorTimerRef.current = setTimeout(
      showWhenPlaybackIsActuallyIdle,
      BUFFERING_INDICATOR_DELAY_MS,
    );
  }, []);

  const pushDebugEntry = useCallback(
    (entry: Omit<PlaybackDebugEntry, 'id' | 'at'>) => {
      if (!__DEV__) {
        return;
      }

      const nextEntry: PlaybackDebugEntry = {
        ...entry,
        id: ++debugEntryIdRef.current,
        at: new Date().toISOString(),
      };
      setDebugEntries(previous => [nextEntry, ...previous].slice(0, 8));
    },
    [],
  );

  useEffect(() => {
    if (activeRequestKey === requestKey) {
      return;
    }

    clearReconnectTimer();
    resetSourceHealth();
    sourceIndexRef.current = 0;
    retriesUsedRef.current = 0;
    cycleExhaustedRef.current = false;
    completedSourceTokenRef.current = null;
    currentProgressRef.current = initialProgress;
    lastProgressSecondRef.current = Math.floor(initialProgress);
    setActiveRequestKey(requestKey);
    setCurrentSourceIndex(0);
    setIsReconnecting(false);
    setReconnectAttempt(0);
    setIsBuffering(false);
    setError(null);
    setIsPaused(false);
    setDuration(initialDuration);
    setCurrentTime(initialProgress);
    setIsCompleted(false);
    setLastFailureReason(null);
    setDebugEntries([]);
  }, [
    activeRequestKey,
    clearReconnectTimer,
    initialDuration,
    initialProgress,
    requestKey,
    resetSourceHealth,
  ]);

  useEffect(() => {
    if (!__DEV__ || !currentSource) {
      return;
    }

    const logKey = `${requestKey}:${sourceRevision}:${currentSource.id}`;
    if (lastRequestLogKeyRef.current === logKey) {
      return;
    }
    lastRequestLogKeyRef.current = logKey;
    loadStartedAtRef.current = Date.now();
    if (__DEV__)
      console.info('[PlayerTiming]', {
        engine: playerEngine,
        platform: Platform.OS,
        mediaKind: request.kind,
        event: 'source-request',
        extension: currentSource.extension,
        delivery: currentSource.delivery,
        sourceAttempt: effectiveSourceIndex + 1,
        sourceCount: sources.length,
        retryAttempt: reconnectAttempt,
      });
    pushDebugEntry({
      label: currentSource.label,
      engine: playerEngine,
      platform: Platform.OS,
      mediaKind: request.kind,
      extension: currentSource.extension,
      delivery: currentSource.delivery,
      sourceAttempt: effectiveSourceIndex + 1,
      sourceCount: sources.length,
      retryAttempt: reconnectAttempt,
      status: 'requesting',
    });
  }, [
    currentSource,
    effectiveSourceIndex,
    pushDebugEntry,
    playerEngine,
    reconnectAttempt,
    request.kind,
    requestKey,
    sourceRevision,
    sources.length,
  ]);

  const handlePlaybackFailure = useCallback(
    (failureReason: string) => {
      clearBufferStallTimer();
      clearBufferingIndicatorTimer();
      clearLiveErrorGraceTimer();
      liveStallWatchActiveRef.current = false;
      setLastFailureReason(failureReason);
      setIsBuffering(false);

      if (cycleExhaustedRef.current || reconnectTimerRef.current) {
        return;
      }

      const decision = decidePlaybackFailure({
        sourceIndex: sourceIndexRef.current,
        sourceCount: sources.length,
        retriesUsed: retriesUsedRef.current,
        isOffline: isOfflineRef.current,
      });

      if (decision.kind === 'wait-for-network') {
        wasOfflineRef.current = true;
        setIsReconnecting(true);
        setError(null);
        return;
      }

      if (!autoReconnect) {
        setError(failureReason);
        setIsReconnecting(false);
        return;
      }

      if (decision.kind === 'retry') {
        retriesUsedRef.current = decision.attempt;
        setReconnectAttempt(decision.attempt);
        setIsReconnecting(true);
        setError(null);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (isOfflineRef.current) {
            wasOfflineRef.current = true;
            setIsReconnecting(true);
            return;
          }
          resetSourceHealth();
          setIsBuffering(true);
          setSourceRevision(previous => previous + 1);
          setIsReconnecting(false);
        }, decision.delayMs);
        return;
      }

      if (decision.kind === 'next-source') {
        sourceIndexRef.current = decision.sourceIndex;
        retriesUsedRef.current = 0;
        setCurrentSourceIndex(decision.sourceIndex);
        setReconnectAttempt(0);
        setError(null);
        setIsReconnecting(false);
        resetSourceHealth();
        setIsBuffering(true);
        setSourceRevision(previous => previous + 1);
        return;
      }

      cycleExhaustedRef.current = true;
      setError('All playback sources failed. Check the connection and retry.');
      setIsReconnecting(false);
      setIsBuffering(false);
      onSourceExhausted?.();
    },
    [
      autoReconnect,
      clearBufferStallTimer,
      clearBufferingIndicatorTimer,
      clearLiveErrorGraceTimer,
      onSourceExhausted,
      resetSourceHealth,
      sources.length,
    ],
  );

  const confirmPlaybackHealthy = useCallback(
    (keepLiveStallWatch = false) => {
      if (isOfflineRef.current) {
        return;
      }

      clearReconnectTimer();
      clearBufferingIndicatorTimer();
      clearLiveErrorGraceTimer();
      if (!keepLiveStallWatch) {
        liveStallWatchActiveRef.current = false;
        clearBufferStallTimer();
      }
      retriesUsedRef.current = 0;
      cycleExhaustedRef.current = false;
      setReconnectAttempt(0);
      setIsReconnecting(false);
      setIsBuffering(false);
      setError(null);
    },
    [
      clearBufferStallTimer,
      clearBufferingIndicatorTimer,
      clearLiveErrorGraceTimer,
      clearReconnectTimer,
    ],
  );

  const armLiveStallTimer = useCallback(() => {
    clearBufferStallTimer();
    bufferStallTimerRef.current = setTimeout(() => {
      bufferStallTimerRef.current = null;
      if (
        !liveStallWatchActiveRef.current ||
        isOfflineRef.current ||
        appStateRef.current !== 'active'
      ) {
        return;
      }
      liveStallWatchActiveRef.current = false;
      handlePlaybackFailure(
        `Live stream stalled for ${LIVE_STALL_TIMEOUT_MS / 1000} seconds`,
      );
    }, LIVE_STALL_TIMEOUT_MS);
  }, [clearBufferStallTimer, handlePlaybackFailure]);

  const handlePlayerError = useCallback(
    (failureReason: string) => {
      const playbackWasRecentlyActive =
        isLive &&
        hasConfirmedPlaybackRef.current &&
        Date.now() - lastPlaybackActivityAtRef.current <=
          LIVE_ERROR_RECOVERY_GRACE_MS * 2;

      if (!playbackWasRecentlyActive) {
        handlePlaybackFailure(failureReason);
        return;
      }

      // Some live engines report a recoverable transport error before they
      // finish resynchronizing. Keep the current source alive briefly; real
      // progress or a ready/buffer-end event cancels this pending failure.
      if (liveErrorGraceTimerRef.current) {
        return;
      }
      setLastFailureReason(failureReason);
      liveErrorGraceTimerRef.current = setTimeout(() => {
        liveErrorGraceTimerRef.current = null;
        handlePlaybackFailure(failureReason);
      }, LIVE_ERROR_RECOVERY_GRACE_MS);
    },
    [handlePlaybackFailure, isLive],
  );

  const onError = useCallback(
    (playerError: any) => {
      const diagnostic = getSanitizedPlaybackError(playerError, [
        connection.username,
        connection.password,
      ]);
      const errorMessage = diagnostic.message;
      if (__DEV__) {
        console.info('[PlayerTiming]', {
          engine: playerEngine,
          platform: Platform.OS,
          mediaKind: request.kind,
          event: 'source-failed',
          extension: currentSource?.extension ?? 'unknown',
          delivery: currentSource?.delivery ?? 'unknown',
          sourceAttempt: sourceIndexRef.current + 1,
          sourceCount: sources.length,
          retryAttempt: retriesUsedRef.current,
          errorCode: diagnostic.code ?? 'unknown',
          error: errorMessage,
          elapsedMs: Date.now() - loadStartedAtRef.current,
        });
      }
      if (currentSource) {
        pushDebugEntry({
          label: currentSource.label,
          engine: playerEngine,
          platform: Platform.OS,
          mediaKind: request.kind,
          extension: currentSource.extension,
          delivery: currentSource.delivery,
          sourceAttempt: sourceIndexRef.current + 1,
          sourceCount: sources.length,
          retryAttempt: retriesUsedRef.current,
          status: 'failed',
          error: errorMessage,
          errorCode: diagnostic.code,
        });
      }
      handlePlayerError(errorMessage);
    },
    [
      connection.password,
      connection.username,
      currentSource,
      handlePlayerError,
      playerEngine,
      pushDebugEntry,
      request.kind,
      sources.length,
    ],
  );

  const onLoad = useCallback(
    (data: { duration?: number }) => {
      hasConfirmedPlaybackRef.current = true;
      lastPlaybackActivityAtRef.current = Date.now();
      lastMediaTimeRef.current = null;
      liveStallWatchActiveRef.current = false;
      confirmPlaybackHealthy();
      const loadedDuration = Number(data.duration);
      setDuration(
        Number.isFinite(loadedDuration) && loadedDuration > 0
          ? loadedDuration
          : initialDuration,
      );
      if (__DEV__) {
        console.info('[PlayerTiming]', {
          engine: playerEngine,
          platform: Platform.OS,
          mediaKind: request.kind,
          event: 'source-loaded',
          extension: currentSource?.extension ?? 'unknown',
          delivery: currentSource?.delivery ?? 'unknown',
          sourceAttempt: sourceIndexRef.current + 1,
          sourceCount: sources.length,
          elapsedMs: Date.now() - loadStartedAtRef.current,
        });
      }

      if (currentSource) {
        pushDebugEntry({
          label: currentSource.label,
          engine: playerEngine,
          platform: Platform.OS,
          mediaKind: request.kind,
          extension: currentSource.extension,
          delivery: currentSource.delivery,
          sourceAttempt: sourceIndexRef.current + 1,
          sourceCount: sources.length,
          retryAttempt: 0,
          status: 'loaded',
        });
      }
    },
    [
      confirmPlaybackHealthy,
      currentSource,
      initialDuration,
      playerEngine,
      pushDebugEntry,
      request.kind,
      sources.length,
    ],
  );

  const onProgress = useCallback(
    (data: { currentTime?: number; seekableDuration?: number }) => {
      const reportedTime = Number(data.currentTime);
      const previousTime = lastMediaTimeRef.current;
      const playbackAdvanced =
        Number.isFinite(reportedTime) &&
        (previousTime === null ||
          Math.abs(reportedTime - previousTime) >=
            PLAYBACK_PROGRESS_EPSILON_SECONDS);

      if (playbackAdvanced) {
        lastMediaTimeRef.current = reportedTime;
        lastPlaybackActivityAtRef.current = Date.now();
        hasConfirmedPlaybackRef.current = true;
        confirmPlaybackHealthy(isLive && liveStallWatchActiveRef.current);
        if (isLive && liveStallWatchActiveRef.current) {
          // A stale "buffering" signal must not win while timestamps continue
          // advancing. Keep watching and fail only after progress truly stops.
          armLiveStallTimer();
        }
      }

      if (isLive) {
        return;
      }

      const nextTime = Number.isFinite(reportedTime) ? reportedTime : 0;
      const seekableDuration = Number(data.seekableDuration);
      if (
        durationRef.current <= 0 &&
        Number.isFinite(seekableDuration) &&
        seekableDuration > 0
      ) {
        setDuration(seekableDuration);
      }
      currentProgressRef.current = nextTime;
      const wholeSecond = Math.floor(nextTime);
      if (wholeSecond !== lastProgressSecondRef.current) {
        lastProgressSecondRef.current = wholeSecond;
        setCurrentTime(nextTime);
      }
    },
    [armLiveStallTimer, confirmPlaybackHealthy, isLive],
  );

  const onEnd = useCallback(() => {
    if (isLive || completedSourceTokenRef.current === sourceToken) {
      return;
    }

    completedSourceTokenRef.current = sourceToken;
    clearReconnectTimer();
    resetSourceHealth();
    setIsBuffering(false);
    setIsReconnecting(false);

    if (duration > 0) {
      currentProgressRef.current = duration;
      lastProgressSecondRef.current = Math.floor(duration);
      setCurrentTime(duration);
    }
    setIsCompleted(true);
  }, [clearReconnectTimer, duration, isLive, resetSourceHealth, sourceToken]);

  const recordSeek = useCallback(
    (time: number) => {
      if (isLive) {
        return;
      }
      const nextTime = Math.max(
        0,
        duration > 0 ? Math.min(duration, time) : time,
      );
      currentProgressRef.current = nextTime;
      lastProgressSecondRef.current = Math.floor(nextTime);
      setCurrentTime(nextTime);
      completedSourceTokenRef.current = null;
      setIsCompleted(false);
    },
    [duration, isLive],
  );

  const onBuffer = useCallback(
    (data: { isBuffering: boolean }) => {
      if (!data.isBuffering) {
        liveStallWatchActiveRef.current = false;
        clearBufferStallTimer();
        clearBufferingIndicatorTimer();
        if (isOfflineRef.current) {
          setIsBuffering(false);
        } else {
          confirmPlaybackHealthy();
        }
        return;
      }

      if (isOfflineRef.current) {
        return;
      }

      scheduleBufferingIndicator();

      if (isLive && !liveStallWatchActiveRef.current) {
        liveStallWatchActiveRef.current = true;
        armLiveStallTimer();
      }
    },
    [
      armLiveStallTimer,
      clearBufferStallTimer,
      clearBufferingIndicatorTimer,
      confirmPlaybackHealthy,
      isLive,
      scheduleBufferingIndicator,
    ],
  );

  const togglePlayPause = useCallback(() => {
    setIsPaused(previous => !previous);
  }, []);

  const retry = useCallback(() => {
    clearReconnectTimer();
    resetSourceHealth();
    sourceIndexRef.current = 0;
    retriesUsedRef.current = 0;
    cycleExhaustedRef.current = false;
    completedSourceTokenRef.current = null;
    setCurrentSourceIndex(0);
    setReconnectAttempt(0);
    setError(null);
    setIsReconnecting(isOfflineRef.current);
    setIsBuffering(false);
    setIsCompleted(false);
    if (!isOfflineRef.current) {
      setIsBuffering(true);
      setSourceRevision(previous => previous + 1);
    }
  }, [clearReconnectTimer, resetSourceHealth]);

  const setPlaybackCompleted = useCallback((completed: boolean) => {
    if (!completed) {
      completedSourceTokenRef.current = null;
    }
    setIsCompleted(completed);
  }, []);

  useEffect(() => {
    if (isOffline) {
      wasOfflineRef.current = true;
      clearReconnectTimer();
      resetSourceHealth();
      setIsReconnecting(true);
      setIsBuffering(false);
      return;
    }

    if (!wasOfflineRef.current) {
      return;
    }

    wasOfflineRef.current = false;
    setIsReconnecting(false);
    if (!cycleExhaustedRef.current) {
      resetSourceHealth();
      setError(null);
      setIsBuffering(true);
      setSourceRevision(previous => previous + 1);
    }
  }, [isOffline, clearReconnectTimer, resetSourceHealth]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasBackgrounded = /inactive|background/.test(appStateRef.current);
        appStateRef.current = nextState;

        if (/inactive|background/.test(nextState)) {
          resumeRecoveryOnForegroundRef.current = Boolean(
            reconnectTimerRef.current ||
              liveErrorGraceTimerRef.current ||
              liveStallWatchActiveRef.current,
          );
          clearReconnectTimer();
          resetSourceHealth();
          setIsBuffering(false);
          setIsReconnecting(isOfflineRef.current);
          return;
        }

        if (!wasBackgrounded || nextState !== 'active') {
          return;
        }
        if (isOfflineRef.current) {
          setIsReconnecting(true);
          return;
        }

        // Native players normally resume their existing source themselves.
        // Replacing it on every foreground transition causes an unnecessary
        // live resync. Resume the fallback cycle only if one was pending.
        if (
          resumeRecoveryOnForegroundRef.current &&
          autoReconnect &&
          !cycleExhaustedRef.current
        ) {
          resumeRecoveryOnForegroundRef.current = false;
          resetSourceHealth();
          setError(null);
          setIsBuffering(true);
          setIsReconnecting(false);
          setSourceRevision(previous => previous + 1);
        } else {
          resumeRecoveryOnForegroundRef.current = false;
          setIsBuffering(false);
          setIsReconnecting(false);
        }
      },
    );

    return () => subscription.remove();
  }, [autoReconnect, clearReconnectTimer, resetSourceHealth]);

  useEffect(
    () => () => {
      clearReconnectTimer();
      resetSourceHealth();
    },
    [clearReconnectTimer, resetSourceHealth],
  );

  // Memoized: a fresh object every render defeated PlayerAdapterView's memo.
  const bufferConfig = useMemo<BufferConfig | undefined>(
    () =>
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
          },
    [isLive],
  );

  // Position a newly applied source starts from. Keyed on the source token
  // (new request or retry) instead of recomputed on every progress tick, so
  // the adapter props stay referentially stable during playback. On the first
  // render of a new request the progress ref still belongs to the previous
  // request, hence the requestIsCurrent guard.
  const resumePosition = useMemo(
    () =>
      getPlaybackResumePosition(
        initialProgress,
        requestIsCurrent ? currentProgressRef.current : initialProgress,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sourceToken keys the recompute on purpose
    [initialProgress, requestIsCurrent, sourceToken],
  );

  return {
    currentProgressRef,
    currentSource,
    sourceToken,
    isReconnecting,
    reconnectAttempt,
    maxRetries: PLAYBACK_RETRY_DELAYS_MS.length,
    isBuffering,
    error,
    lastFailureReason,
    isPaused,
    shouldPause: isPaused || isOffline,
    duration: requestIsCurrent ? duration : initialDuration,
    currentTime: effectiveCurrentTime,
    resumePosition,
    isCompleted,
    bufferConfig,
    debugEntries,
    onError,
    onLoad,
    onProgress,
    onBuffer,
    onEnd,
    recordSeek,
    togglePlayPause,
    retry,
    setIsPaused,
    setIsCompleted: setPlaybackCompleted,
  };
}
