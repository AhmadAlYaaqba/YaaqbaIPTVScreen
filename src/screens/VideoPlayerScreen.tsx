import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { AppState, View, StyleSheet, StatusBar, Platform } from 'react-native';
import Orientation from 'react-native-orientation-locker';

import { IS_TABLET } from '../utils/device';
import { useFocusEffect } from '@react-navigation/native';
import type { RootScreenProps } from '../navigation/types';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { storage } from '../utils/storage';
import {
  createVlcFallbackRequest,
  switchLivePlaybackRequest,
} from '../utils/playbackSources';
import { getMediaDurationSeconds } from '../utils/playbackTime';
import {
  getXtreamErrorMessage,
  useXtreamCategoryContent,
} from '../services/xtream/xtreamQueries';
import type {
  XtreamLiveStream,
  XtreamSession,
} from '../services/xtream/xtreamService';

import PlayerControls from '../components/PlayerControls';
import ChannelSwitcher from '../components/ChannelSwitcher';
import { useTVRemote } from '../tv/useTVRemote';
import { useBackHandler } from '../tv/useBackHandler';
import type { TVRemoteAction } from '../tv/remoteActions';
import PlayerAdapterView from '../components/PlayerAdapterView';
import {
  PLAYER_ENGINE_LABELS,
  VIDEO_CONTENT_MODES,
  type PlaybackRequest,
  type PlayerAdapter,
  type PlayerEngine,
} from '../types/player';
import { setUserPreferences } from '../store/slices/userSlice';
import { setGlobalVideoContentMode } from '../services/playlists/playlistStore';
import { playbackRequestToHistoryInput } from '../utils/historyPlayback';
import DevStreamDebugOverlay from '../components/DevStreamDebugOverlay';

// Hooks
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { usePlayerGestures } from '../hooks/usePlayerGestures';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

type Props = RootScreenProps<'VideoPlayer'>;

// Dev-only stream overlay; enable with EXPO_PUBLIC_STREAM_DEBUG=1 in .env.
// Dead-code-eliminated from release bundles by the __DEV__ guard.
const SHOW_STREAM_DEBUG_OVERLAY =
  __DEV__ && process.env.EXPO_PUBLIC_STREAM_DEBUG === '1';

const CONTROLS_TIMEOUT = 5000; // Auto-hide controls after 5 seconds
const EMPTY_CHANNELS: XtreamLiveStream[] = [];

const VideoPlayerScreen: React.FC<Props> = ({ route, navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [playbackRequest, setPlaybackRequest] = useState<PlaybackRequest>(
    route.params.request,
  );

  const {
    playlistId,
    playerEngine,
    useProxy,
    username,
    password,
    serverDomain,
    serverPort,
    videoContentMode,
  } = useSelector((state: RootState) => state.user);
  const [sessionPlayerEngine, setSessionPlayerEngine] =
    useState<PlayerEngine>(playerEngine);

  // A new route param (navigating to the player again while it is mounted)
  // restarts playback on the configured engine. The engine is read through a
  // ref so a Redux preference change alone can no longer revert an in-session
  // channel switch or engine fallback.
  const preferredEngineRef = useRef(playerEngine);
  useEffect(() => {
    preferredEngineRef.current = playerEngine;
  }, [playerEngine]);
  useEffect(() => {
    setPlaybackRequest(route.params.request);
    setSessionPlayerEngine(preferredEngineRef.current);
  }, [route.params.request]);
  const connection = useMemo(
    () => ({
      domain: serverDomain,
      port: serverPort,
      username,
      password,
    }),
    [password, serverDomain, serverPort, username],
  );
  const isLive = playbackRequest.kind === 'live';
  const title = playbackRequest.title;
  const seriesId =
    playbackRequest.kind === 'episode' ? playbackRequest.seriesId : undefined;
  const episodeId =
    playbackRequest.kind === 'episode' ? playbackRequest.streamId : undefined;
  const episodeList =
    playbackRequest.kind === 'episode'
      ? playbackRequest.episodeList
      : undefined;
  const currentEpisodeIndex =
    playbackRequest.kind === 'episode'
      ? playbackRequest.currentEpisodeIndex
      : undefined;
  const movieId =
    playbackRequest.kind === 'movie' ? playbackRequest.streamId : undefined;
  const currentStreamId = playbackRequest.streamId;
  const currentChannelName =
    playbackRequest.kind === 'live'
      ? playbackRequest.channelName
      : playbackRequest.title;
  const categoryId =
    playbackRequest.kind === 'live' ? playbackRequest.categoryId : undefined;
  const session = useMemo<XtreamSession | null>(
    () =>
      playlistId
        ? {
            playlistId,
            username,
            password,
            domain: serverDomain,
            port: serverPort,
            useProxy,
          }
        : null,
    [playlistId, username, password, serverDomain, serverPort, useProxy],
  );
  const liveChannelsQuery = useXtreamCategoryContent(
    session,
    'live',
    isLive ? categoryId ?? null : null,
  );
  const liveChannels = liveChannelsQuery.data ?? EMPTY_CHANNELS;
  const liveChannelsError = getXtreamErrorMessage(liveChannelsQuery.error);
  const refetchLiveChannels = liveChannelsQuery.refetch;
  const { isOffline } = useNetworkStatus();

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Channel switcher
  const [channelSwitcherVisible, setChannelSwitcherVisible] = useState(false);

  // Every engine receives the same selected fallback source.
  const player = useVideoPlayer({
    request: playbackRequest,
    connection,
    playlistId,
    playerEngine: sessionPlayerEngine,
    isOffline,
    useProxy,
    autoReconnect: true,
  });
  const playerRef = useRef<PlayerAdapter>(null);
  const recordSeek = player.recordSeek;

  // Engine fallback offered once every source has failed. VLC and the system
  // player cover different provider quirks (raw TS vs. clean HLS/MP4), so each
  // falls back to the other; Expo Video falls back to VLC. Live streams switch
  // engines in place; VOD carries its resume position across.
  const fallbackEngine: PlayerEngine =
    sessionPlayerEngine === 'vlc' ? 'native' : 'vlc';
  const handleTryWithFallbackEngine = useCallback(() => {
    setPlaybackRequest(current =>
      createVlcFallbackRequest(
        current,
        player.currentProgressRef.current,
        player.duration,
      ),
    );
    setSessionPlayerEngine(fallbackEngine);
  }, [fallbackEngine, player.currentProgressRef, player.duration]);

  // --- Controls auto-hide logic ---
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!player.isPaused && !player.error && !player.isReconnecting) {
        setControlsVisible(false);
      }
    }, CONTROLS_TIMEOUT);
  }, [player.isPaused, player.error, player.isReconnecting]);

  const pauseControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const toggleControls = useCallback(() => {
    setControlsVisible(prev => {
      const next = !prev;
      if (next) {
        resetControlsTimeout();
      }
      return next;
    });
  }, [resetControlsTimeout]);

  // --- Seek ---
  const handleSeek = useCallback(
    (time: number) => {
      recordSeek(time);
      playerRef.current?.seek(time);
      resetControlsTimeout();
    },
    [recordSeek, resetControlsTimeout],
  );

  // Gesture hook (brightness, seek)
  const gestures = usePlayerGestures({
    isLive,
    duration: player.duration,
    onSeek: handleSeek,
  });
  const seekByDoubleTap = gestures.handleDoubleTap;
  const handleDoubleTap = useCallback(
    (x: number) => seekByDoubleTap(x, player.currentTime),
    [player.currentTime, seekByDoubleTap],
  );

  // Show controls initially, then auto-hide
  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  // Reset auto-hide when paused/error state changes
  useEffect(() => {
    if (player.isPaused || player.error || player.isReconnecting) {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimeout();
    }
  }, [
    player.isPaused,
    player.error,
    player.isReconnecting,
    resetControlsTimeout,
  ]);

  // --- Orientation lock ---
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    StatusBar.setHidden(true);
    // TVs are always landscape, and iPads keep whatever orientation the user
    // is holding; locking either is unnecessary.
    if (!Platform.isTV && !IS_TABLET) {
      Orientation.lockToLandscape();
    }

    return () => {
      StatusBar.setHidden(false);
      if (!Platform.isTV && !IS_TABLET) {
        Orientation.lockToPortrait();
      }
    };
  }, [navigation]);

  // --- Progress saving (for VOD) ---
  const progressSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const durationRef = useRef(player.duration);
  const lastSavedProgressRef = useRef(-1);
  const completionHandledRef = useRef<string | null>(null);
  const recordedPlaybackKeyRef = useRef<string | null>(null);
  durationRef.current = player.duration;
  const progressContentKey = `${playlistId ?? 'none'}:${playbackRequest.kind}:${
    seriesId ?? ''
  }:${playbackRequest.streamId}`;

  useEffect(() => {
    lastSavedProgressRef.current = -1;
  }, [progressContentKey]);

  const saveProgress = useCallback(
    async (currentProgress: number, force = false) => {
      const totalDuration = durationRef.current;
      if (
        isLive ||
        (!force && completionHandledRef.current === progressContentKey) ||
        !Number.isFinite(currentProgress) ||
        currentProgress <= 0 ||
        totalDuration <= 0
      ) {
        return;
      }
      if (
        !force &&
        Math.abs(currentProgress - lastSavedProgressRef.current) < 1
      ) {
        return;
      }

      const contentId = episodeId || movieId;
      if (!contentId) {
        return;
      }
      lastSavedProgressRef.current = currentProgress;
      await storage.saveWatchProgress(
        {
          contentId,
          progress: currentProgress,
          timestamp: Date.now(),
          totalDuration,
          title: title || '',
          seriesId,
          episodeId,
        },
        Boolean(movieId),
      );
      const historyItem = playbackRequestToHistoryInput(
        playbackRequest,
        currentProgress,
        totalDuration,
      );
      await Promise.all([
        storage.saveWatchHistory(historyItem),
        storage.saveLatestWatched(historyItem),
      ]);
    },
    [
      episodeId,
      isLive,
      movieId,
      playbackRequest,
      progressContentKey,
      seriesId,
      title,
    ],
  );

  const flushProgress = useCallback(
    (force = false) => saveProgress(player.currentProgressRef.current, force),
    [player.currentProgressRef, saveProgress],
  );

  useEffect(() => {
    if (isLive) {
      return;
    }

    progressSaveIntervalRef.current = setInterval(() => {
      flushProgress();
    }, 30000);

    return () => {
      flushProgress();
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
        progressSaveIntervalRef.current = null;
      }
    };
  }, [flushProgress, isLive]);

  // Latest flush for the subscriptions below. They must not re-run on every
  // request/title change: the focus-effect cleanup stops the player, and a
  // re-run on a channel switch tore the freshly applied source down again.
  const flushProgressRef = useRef(flushProgress);
  useEffect(() => {
    flushProgressRef.current = flushProgress;
  }, [flushProgress]);

  useEffect(() => {
    if (isLive) {
      return;
    }
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'inactive' || nextState === 'background') {
        flushProgressRef.current();
      }
    });
    return () => subscription.remove();
  }, [isLive]);

  // --- Stop playback and flush progress when the screen loses focus ---
  // Pressing back blurs the screen immediately (before the exit animation and
  // before unmount), while the native player view is still alive to receive the
  // command. This is more reliable than relying on unmount alone. The callback
  // has stable identity so this runs only on a real blur/unmount.
  useFocusEffect(
    useCallback(() => {
      return () => {
        flushProgressRef.current();
        // VLC engines need an explicit stop; the native (ExoPlayer/AVPlayer)
        // players stop themselves and expose stop as a pause. Optional in the
        // PlayerHandle contract, hence the ?. on the method itself.
        playerRef.current?.stop?.();
      };
    }, []),
  );

  // --- Auto-play next episode ---
  const playbackCompleted = player.isCompleted;
  const resetPlaybackCompletion = player.setIsCompleted;
  useEffect(() => {
    if (
      !playbackCompleted ||
      completionHandledRef.current === progressContentKey
    ) {
      return;
    }
    completionHandledRef.current = progressContentKey;
    let cancelled = false;

    (async () => {
      await flushProgress(true);
      if (playbackRequest.kind === 'episode') {
        await storage.completeWatchProgress(
          playbackRequest.streamId,
          false,
          playbackRequest.seriesId,
          playbackRequest.streamId,
        );
      } else if (playbackRequest.kind === 'movie') {
        await storage.completeWatchProgress(playbackRequest.streamId, true);
      }
      if (cancelled) return;

      if (
        playbackRequest.kind === 'episode' &&
        seriesId &&
        episodeList &&
        currentEpisodeIndex !== undefined
      ) {
        const nextEpisodeIndex = currentEpisodeIndex + 1;
        if (nextEpisodeIndex < episodeList.length) {
          const nextEpisode = episodeList[nextEpisodeIndex];
          const nextEpisodeId = String(nextEpisode.id);
          const ext =
            nextEpisode.container_extension?.replace('.', '') || 'mp4';

          resetPlaybackCompletion(false);
          setPlaybackRequest({
            kind: 'episode',
            streamId: nextEpisodeId,
            extension: ext,
            title: nextEpisode.title || 'Episode',
            expectedDuration:
              getMediaDurationSeconds(nextEpisode) ??
              playbackRequest.expectedDuration,
            thumbnail: playbackRequest.thumbnail,
            seriesId,
            seriesName: playbackRequest.seriesName,
            episodeNumber:
              typeof nextEpisode.episode_num === 'number'
                ? nextEpisode.episode_num
                : typeof nextEpisode.episode === 'number'
                ? nextEpisode.episode
                : nextEpisodeIndex + 1,
            seasonNumber: playbackRequest.seasonNumber,
            episodeList,
            currentEpisodeIndex: nextEpisodeIndex,
          });
        } else {
          navigation.goBack();
        }
      } else if (movieId) {
        navigation.goBack();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentEpisodeIndex,
    episodeId,
    episodeList,
    movieId,
    navigation,
    playbackCompleted,
    playbackRequest,
    progressContentKey,
    resetPlaybackCompletion,
    seriesId,
    flushProgress,
  ]);

  const handlePlayerLoad = useCallback(
    (data: { duration: number }) => {
      player.onLoad(data);
      if (recordedPlaybackKeyRef.current === progressContentKey) return;
      recordedPlaybackKeyRef.current = progressContentKey;
      const item = playbackRequestToHistoryInput(
        playbackRequest,
        playbackRequest.kind === 'live' ? 0 : player.currentProgressRef.current,
        data.duration,
      );
      storage.saveWatchHistory(item);
      storage.saveLatestWatched(item);
    },
    [playbackRequest, player, progressContentKey],
  );

  // --- Channel switch ---
  const handleChannelSwitch = useCallback(
    (
      newStreamId: string,
      newChannelName: string,
      newExtension: string,
      newThumbnail?: string,
      newCategoryId?: string,
    ) => {
      if (playbackRequest.kind === 'live') {
        setPlaybackRequest(
          switchLivePlaybackRequest(playbackRequest, {
            streamId: newStreamId,
            channelName: newChannelName,
            extension: newExtension,
            thumbnail: newThumbnail,
            categoryId: newCategoryId,
          }),
        );
      }
      setChannelSwitcherVisible(false);
    },
    [playbackRequest],
  );

  const toggleChannelSwitcher = useCallback(() => {
    setChannelSwitcherVisible(v => !v);
  }, []);

  const closeChannelSwitcher = useCallback(() => {
    setChannelSwitcherVisible(false);
  }, []);

  const handleCycleContentMode = useCallback(() => {
    const index = VIDEO_CONTENT_MODES.indexOf(videoContentMode);
    const next = VIDEO_CONTENT_MODES[(index + 1) % VIDEO_CONTENT_MODES.length];
    dispatch(setUserPreferences({ videoContentMode: next }));
    setGlobalVideoContentMode(next).catch(error => {
      if (__DEV__) console.error('Error saving aspect ratio:', error);
    });
  }, [dispatch, videoContentMode]);

  const retryLiveChannels = useCallback(() => {
    refetchLiveChannels();
  }, [refetchLiveChannels]);

  const handleGoBack = useCallback(() => {
    flushProgress();
    navigation.goBack();
  }, [flushProgress, navigation]);

  // --- TV remote (no-op on phones) ---
  // Select while controls are hidden is handled natively by PlayerControls'
  // focus-holder Pressable. While controls are visible the D-pad moves focus
  // between buttons, so here we only keep the auto-hide timer alive.
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const seekBy = useCallback(
    (seconds: number) => {
      if (isLive) {
        return;
      }
      const target = player.currentTime + seconds;
      handleSeek(
        Math.max(
          0,
          player.duration > 0 ? Math.min(player.duration, target) : target,
        ),
      );
      revealControls();
    },
    [handleSeek, isLive, player.currentTime, player.duration, revealControls],
  );

  const switchAdjacentChannel = useCallback(
    (step: 1 | -1) => {
      const count = liveChannels.length;
      if (!isLive || count === 0) {
        return;
      }
      const index = liveChannels.findIndex(
        channel => String(channel.stream_id) === currentStreamId,
      );
      const nextIndex =
        index < 0
          ? step === 1
            ? 0
            : count - 1
          : (index + step + count) % count;
      const next = liveChannels[nextIndex];
      handleChannelSwitch(
        String(next.stream_id),
        next.name,
        (next.container_extension || 'm3u8').replace(/^\./, '') || 'm3u8',
        next.stream_icon,
      );
      revealControls();
    },
    [
      currentStreamId,
      handleChannelSwitch,
      isLive,
      liveChannels,
      revealControls,
    ],
  );

  const handleRemoteAction = useCallback(
    (action: TVRemoteAction) => {
      if (channelSwitcherVisible) {
        return; // the channel list owns focus; Back closes it
      }
      switch (action) {
        case 'playPause':
          player.togglePlayPause();
          revealControls();
          return;
        case 'rewind':
          seekBy(-30);
          return;
        case 'fastForward':
          seekBy(30);
          return;
        case 'channelUp':
        case 'next':
          switchAdjacentChannel(1);
          return;
        case 'channelDown':
        case 'previous':
          switchAdjacentChannel(-1);
          return;
      }
      if (player.error && (action === 'left' || action === 'right')) {
        return; // D-pad moves focus between Retry and the switch-player button
      }
      if (controlsVisible) {
        resetControlsTimeout();
        return;
      }
      switch (action) {
        case 'left':
          seekBy(-10);
          return;
        case 'right':
          seekBy(10);
          return;
        case 'up':
        case 'down':
          if (isLive) {
            setChannelSwitcherVisible(true);
          } else {
            revealControls();
          }
          return;
        case 'info':
        case 'menu':
          revealControls();
          return;
      }
    },
    [
      channelSwitcherVisible,
      controlsVisible,
      isLive,
      player,
      resetControlsTimeout,
      revealControls,
      seekBy,
      switchAdjacentChannel,
    ],
  );
  useTVRemote(handleRemoteAction);

  // Back closes the channel list, then hides controls, then leaves (saving
  // progress). TV only for now; phones keep their current back behavior.
  useBackHandler(() => {
    if (channelSwitcherVisible) {
      setChannelSwitcherVisible(false);
      return true;
    }
    if (
      controlsVisible &&
      !player.isPaused &&
      !player.error &&
      !player.isReconnecting
    ) {
      pauseControlsTimeout();
      setControlsVisible(false);
      return true;
    }
    handleGoBack();
    return true;
  }, Platform.isTV);

  return (
    <View style={styles.container}>
      <PlayerAdapterView
        ref={playerRef}
        engine={sessionPlayerEngine}
        source={player.currentSource}
        sourceToken={player.sourceToken}
        isLive={isLive}
        isPaused={player.shouldPause}
        resumePosition={player.resumePosition}
        contentMode={videoContentMode}
        bufferConfig={player.bufferConfig}
        onLoad={handlePlayerLoad}
        onError={player.onError}
        onProgress={player.onProgress}
        onBuffer={player.onBuffer}
        onEnd={player.onEnd}
      />

      <PlayerControls
        visible={controlsVisible}
        channelName={currentChannelName}
        isLive={isLive}
        isPaused={player.isPaused}
        isBuffering={player.isBuffering}
        isReconnecting={player.isReconnecting}
        reconnectAttempt={player.reconnectAttempt}
        maxRetries={player.maxRetries}
        error={player.error}
        currentTime={player.currentTime}
        duration={player.duration}
        brightness={gestures.brightness}
        showBrightnessIndicator={gestures.showBrightnessIndicator}
        brightnessIndicatorStyle={gestures.brightnessIndicatorStyle}
        brightnessOverlayStyle={gestures.brightnessOverlayStyle}
        brightnessFillStyle={gestures.brightnessFillStyle}
        onTogglePlayPause={player.togglePlayPause}
        onGoBack={handleGoBack}
        onSeek={handleSeek}
        onSeekInteractionStart={pauseControlsTimeout}
        onSeekInteractionEnd={resetControlsTimeout}
        onRetry={player.retry}
        fallbackActionLabel={
          player.error
            ? `Try with ${PLAYER_ENGINE_LABELS[fallbackEngine]} player`
            : undefined
        }
        onFallbackAction={player.error ? handleTryWithFallbackEngine : undefined}
        onToggleVisibility={toggleControls}
        tvOverlayOpen={channelSwitcherVisible}
        contentMode={videoContentMode}
        onCycleContentMode={handleCycleContentMode}
        onDoubleTap={isLive ? undefined : handleDoubleTap}
        onToggleChannelSwitcher={isLive ? toggleChannelSwitcher : undefined}
        onVerticalPanStart={gestures.onVerticalPanStart}
        onVerticalPanMove={gestures.onVerticalPanMove}
        onVerticalPanEnd={gestures.onVerticalPanEnd}
      />

      {/* Channel switcher panel (live only) */}
      {isLive && (
        <ChannelSwitcher
          playlistId={playlistId}
          visible={channelSwitcherVisible}
          channels={liveChannels}
          currentCategoryId={categoryId}
          activeStreamId={currentStreamId}
          isLoading={liveChannelsQuery.isPending}
          isOffline={isOffline}
          error={liveChannelsError}
          onRetry={retryLiveChannels}
          onSelectChannel={handleChannelSwitch}
          onClose={closeChannelSwitcher}
        />
      )}

      {SHOW_STREAM_DEBUG_OVERLAY ? (
        <DevStreamDebugOverlay
          playerName={sessionPlayerEngine}
          sourceLabel={player.currentSource.label}
          isBuffering={player.isBuffering}
          isReconnecting={player.isReconnecting}
          reconnectAttempt={player.reconnectAttempt}
          lastFailureReason={player.lastFailureReason}
          debugEntries={player.debugEntries}
        />
      ) : null}
    </View>
  );
};

export default VideoPlayerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});
