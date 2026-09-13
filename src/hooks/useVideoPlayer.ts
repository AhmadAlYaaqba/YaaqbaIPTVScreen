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

const LIVE_STALL_TIMEOUT_MS = 12000;

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
  const currentProgressRef = useRef(initialProgress);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
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

  const requestIsCurrent = activeRequestKey === requestKey;
  const effectiveSourceIndex = requestIsCurrent ? currentSourceIndex : 0;
  const effectiveCurrentTime = requestIsCurrent ? currentTime : initialProgress;
  const currentSource = sources[effectiveSourceIndex] ?? sources[0];
  const sourceToken = `${requestKey}:${sourceRevision}`;
  sourceIndexRef.current = effectiveSourceIndex;
  isOfflineRef.current = isOffline;

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
    clearBufferStallTimer();
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
    clearBufferStallTimer,
    clearReconnectTimer,
    initialDuration,
    initialProgress,
    requestKey,
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
      setLastFailureReason(failureReason);

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
    [autoReconnect, clearBufferStallTimer, onSourceExhausted, sources.length],
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
      handlePlaybackFailure(errorMessage);
    },
    [
      connection.password,
      connection.username,
      currentSource,
      handlePlaybackFailure,
      playerEngine,
      pushDebugEntry,
      request.kind,
      sources.length,
    ],
  );

  const onLoad = useCallback(
    (data: { duration?: number }) => {
      clearReconnectTimer();
      clearBufferStallTimer();
      const loadedDuration = Number(data.duration);
      setDuration(
        Number.isFinite(loadedDuration) && loadedDuration > 0
          ? loadedDuration
          : initialDuration,
      );
      setError(null);
      setIsReconnecting(false);
      setReconnectAttempt(0);
      setIsBuffering(false);

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
      clearBufferStallTimer,
      clearReconnectTimer,
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
      if (isLive) {
        return;
      }

      const nextTime = data.currentTime || 0;
      const seekableDuration = Number(data.seekableDuration);
      if (
        duration <= 0 &&
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
    [duration, isLive],
  );

  const onEnd = useCallback(() => {
    if (isLive || completedSourceTokenRef.current === sourceToken) {
      return;
    }

    completedSourceTokenRef.current = sourceToken;
    clearReconnectTimer();
    clearBufferStallTimer();
    setIsBuffering(false);
    setIsReconnecting(false);

    if (duration > 0) {
      currentProgressRef.current = duration;
      lastProgressSecondRef.current = Math.floor(duration);
      setCurrentTime(duration);
    }
    setIsCompleted(true);
  }, [
    clearBufferStallTimer,
    clearReconnectTimer,
    duration,
    isLive,
    sourceToken,
  ]);

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
      setIsBuffering(data.isBuffering);

      if (!data.isBuffering || !isLive || isOfflineRef.current) {
        clearBufferStallTimer();
        return;
      }

      clearBufferStallTimer();
      bufferStallTimerRef.current = setTimeout(() => {
        bufferStallTimerRef.current = null;
        handlePlaybackFailure('Live stream stalled for 12 seconds');
      }, LIVE_STALL_TIMEOUT_MS);
    },
    [clearBufferStallTimer, handlePlaybackFailure, isLive],
  );

  const togglePlayPause = useCallback(() => {
    setIsPaused(previous => !previous);
  }, []);

  const retry = useCallback(() => {
    clearReconnectTimer();
    clearBufferStallTimer();
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
      setSourceRevision(previous => previous + 1);
    }
  }, [clearBufferStallTimer, clearReconnectTimer]);

  const setPlaybackCompleted = useCallback(
    (completed: boolean) => {
      if (!completed) {
        completedSourceTokenRef.current = null;
      }
      setIsCompleted(completed);
    },
    [],
  );

  useEffect(() => {
    if (isOffline) {
      wasOfflineRef.current = true;
      clearReconnectTimer();
      clearBufferStallTimer();
      setIsReconnecting(true);
      return;
    }

    if (!wasOfflineRef.current) {
      return;
    }

    wasOfflineRef.current = false;
    setIsReconnecting(false);
    if (!cycleExhaustedRef.current) {
      setError(null);
      setSourceRevision(previous => previous + 1);
    }
  }, [isOffline, clearBufferStallTimer, clearReconnectTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasBackgrounded =
          appStateRef.current.match(/inactive|background/);
        appStateRef.current = nextState;
        if (
          wasBackgrounded &&
          nextState === 'active' &&
          autoReconnect &&
          !isOfflineRef.current &&
          !cycleExhaustedRef.current
        ) {
          setError(null);
          setIsReconnecting(false);
          setSourceRevision(previous => previous + 1);
        }
      },
    );

    return () => subscription.remove();
  }, [autoReconnect]);

  useEffect(
    () => () => {
      clearReconnectTimer();
      clearBufferStallTimer();
    },
    [clearBufferStallTimer, clearReconnectTimer],
  );

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
    currentSource,
    currentSourceIndex: effectiveSourceIndex,
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
    resumePosition: getPlaybackResumePosition(
      initialProgress,
      effectiveCurrentTime,
    ),
    isCompleted,
    bufferConfig,
    sources,
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
    setDuration,
    setIsCompleted: setPlaybackCompleted,
  };
}
