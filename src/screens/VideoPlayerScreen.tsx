import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { useFocusEffect } from '@react-navigation/native';
import type { RootScreenProps } from '../navigation/types';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { storage } from '../utils/storage';
import {
  buildDirectPlaybackUrl,
  switchLivePlaybackRequest,
} from '../utils/playbackSources';
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
import PlayerAdapterView from '../components/PlayerAdapterView';
import type { PlaybackRequest, PlayerAdapter } from '../types/player';
// import DevStreamDebugOverlay from '../components/DevStreamDebugOverlay';


// Hooks
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { usePlayerGestures } from '../hooks/usePlayerGestures';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

type Props = RootScreenProps<'VideoPlayer'>;

const CONTROLS_TIMEOUT = 5000; // Auto-hide controls after 5 seconds
const EMPTY_CHANNELS: XtreamLiveStream[] = [];

const VideoPlayerScreen: React.FC<Props> = ({ route, navigation }) => {
  const [playbackRequest, setPlaybackRequest] = useState<PlaybackRequest>(
    route.params.request,
  );

  useEffect(() => {
    setPlaybackRequest(route.params.request);
  }, [route.params.request]);

  const {
    playlistId,
    playerEngine,
    useProxy,
    username,
    password,
    serverDomain,
    serverPort,
  } = useSelector((state: RootState) => state.user);
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
  const currentContainerExtension = playbackRequest.extension;
  const currentChannelName =
    playbackRequest.kind === 'live'
      ? playbackRequest.channelName
      : playbackRequest.title;
  const currentThumbnail = playbackRequest.thumbnail ?? '';
  const categoryId =
    playbackRequest.kind === 'live'
      ? playbackRequest.categoryId
      : undefined;
  const currentStreamUrl = useMemo(
    () => buildDirectPlaybackUrl(playbackRequest, connection),
    [connection, playbackRequest],
  );
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
    playerEngine,
    isOffline,
    useProxy,
    autoReconnect: true,
  });
  const playerRef = useRef<PlayerAdapter>(null);

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
      playerRef.current?.seek(time);
      resetControlsTimeout();
    },
    [resetControlsTimeout],
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
  }, [player.isPaused, player.error, player.isReconnecting, resetControlsTimeout]);

  // --- Orientation lock ---
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    StatusBar.setHidden(true);
    Orientation.lockToLandscape();

    return () => {
      StatusBar.setHidden(false);
      Orientation.lockToPortrait();
    };
  }, [navigation]);




  // --- Stop playback when the screen loses focus ---
  // Pressing back blurs the screen immediately (before the exit animation and
  // before unmount), while the native player view is still alive to receive the
  // command. This is more reliable than relying on unmount alone.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (__DEV__) console.log('[VideoPlayerScreen] blur — stopping player');
        // VLC engines need an explicit stop; the native (ExoPlayer/AVPlayer)
        // players stop themselves and expose stop as a pause. Optional in the
        // PlayerHandle contract, hence the ?. on the method itself.
        playerRef.current?.stop?.();
      };
    }, []),
  );

  // --- Progress saving (for VOD) ---
  const progressSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveProgress = useCallback(
    async (currentProgress: number) => {
      if (isLive) {
        return;
      }
      const contentId = episodeId || movieId;
      if (!contentId || currentProgress <= 0) {
        return;
      }

      await storage.saveWatchProgress(
        {
          contentId,
          progress: currentProgress,
          timestamp: Date.now(),
          totalDuration: player.duration,
          title: title || '',
          seriesId,
          episodeId,
        },
        !!movieId,
      );
    },
    [isLive, episodeId, movieId, player.duration, title, seriesId],
  );

  useEffect(() => {
    if (isLive) {
      return;
    }

    progressSaveIntervalRef.current = setInterval(() => {
      if (player.currentProgressRef.current > 0 && player.duration > 0) {
        saveProgress(player.currentProgressRef.current);
      }
    }, 30000);

    return () => {
      if (player.currentProgressRef.current > 0) {
        saveProgress(player.currentProgressRef.current);
      }
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
    };
  }, [isLive, player.currentProgressRef, player.duration, saveProgress]);

  // --- Auto-play next episode ---
  const playbackCompleted = player.isCompleted;
  const resetPlaybackCompletion = player.setIsCompleted;
  useEffect(() => {
    if (playbackCompleted) {
      if (seriesId && episodeList && currentEpisodeIndex !== undefined) {
          const nextEpisodeIndex = currentEpisodeIndex + 1;
        if (nextEpisodeIndex < episodeList.length) {
          const nextEpisode = episodeList[nextEpisodeIndex];
          const nextEpisodeId = String(nextEpisode.id);
          const ext = nextEpisode.container_extension?.replace('.', '') || 'mp4';

          resetPlaybackCompletion(false);
          setPlaybackRequest({
            kind: 'episode',
            streamId: nextEpisodeId,
            extension: ext,
            title: nextEpisode.title || 'Episode',
            seriesId,
            episodeList,
            currentEpisodeIndex: nextEpisodeIndex,
          });
        } else {
          storage.clearWatchProgress(seriesId, false, seriesId, episodeId);
          navigation.goBack();
        }
      } else if (movieId) {
        storage.clearWatchProgress(movieId, true);
        navigation.goBack();
      }
    }
  }, [
    currentEpisodeIndex,
    episodeId,
    episodeList,
    movieId,
    navigation,
    playbackCompleted,
    resetPlaybackCompletion,
    seriesId,
  ]);

  // --- Recently watched tracking ---
  useEffect(() => {
    if (playbackRequest.kind === 'live') {
      return;
    }

    if (playbackRequest.kind === 'episode') {
      const item = {
        id: playbackRequest.seriesId,
        type: 'series' as const,
        name: playbackRequest.title,
        timestamp: Date.now(),
        progress: playbackRequest.resume?.progress ?? 0,
        totalDuration: playbackRequest.resume?.totalDuration,
        seriesId: playbackRequest.seriesId,
        episodeId: playbackRequest.streamId,
        thumbnail: playbackRequest.thumbnail,
        streamUrl: currentStreamUrl,
        containerExtension: playbackRequest.extension,
      };
      storage.saveRecentlyWatched(item);
      storage.saveLatestWatched(item);
    } else {
      const item = {
        id: playbackRequest.streamId,
        type: 'movie' as const,
        name: playbackRequest.title,
        timestamp: Date.now(),
        progress: playbackRequest.resume?.progress ?? 0,
        totalDuration: playbackRequest.resume?.totalDuration,
        thumbnail: playbackRequest.thumbnail,
        streamUrl: currentStreamUrl,
        containerExtension: playbackRequest.extension,
      };
      storage.saveRecentlyWatched(item);
      storage.saveLatestWatched(item);
    }
  }, [currentStreamUrl, playbackRequest]);

  useEffect(() => {
    if (!isLive || !currentStreamId || !currentChannelName) {
      return;
    }

    storage.saveLatestWatched({
        id: currentStreamId,
        type: 'live',
        name: currentChannelName,
        timestamp: Date.now(),
        streamId: currentStreamId,
        streamUrl: currentStreamUrl,
        containerExtension: currentContainerExtension,
        categoryId,
        channelName: currentChannelName,
        thumbnail: currentThumbnail,
    });
  }, [
    categoryId,
    currentChannelName,
    currentContainerExtension,
    currentStreamId,
    currentStreamUrl,
    currentThumbnail,
    isLive,
  ]);

  // --- Channel switch ---
  const handleChannelSwitch = useCallback(
    (
      newStreamId: string,
      newChannelName: string,
      newExtension: string,
      newThumbnail?: string,
    ) => {
      if (playbackRequest.kind === 'live') {
        setPlaybackRequest(
          switchLivePlaybackRequest(playbackRequest, {
            streamId: newStreamId,
            channelName: newChannelName,
            extension: newExtension,
            thumbnail: newThumbnail,
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

  const retryLiveChannels = useCallback(() => {
    refetchLiveChannels();
  }, [refetchLiveChannels]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <PlayerAdapterView
        ref={playerRef}
        engine={playerEngine}
        source={player.currentSource}
        sourceToken={player.sourceToken}
        isLive={isLive}
        isPaused={player.shouldPause}
        resumePosition={player.resumePosition}
        bufferConfig={player.bufferConfig}
        onLoad={player.onLoad}
        onError={player.onError}
        onProgress={player.onProgress}
        onBuffer={player.onBuffer}
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
        onRetry={player.retry}
        onToggleVisibility={toggleControls}
        onDoubleTap={isLive ? undefined : handleDoubleTap}
        onToggleChannelSwitcher={isLive ? toggleChannelSwitcher : undefined}
        onVerticalPanStart={gestures.onVerticalPanStart}
        onVerticalPanMove={gestures.onVerticalPanMove}
        onVerticalPanEnd={gestures.onVerticalPanEnd}
      />

      {/* Channel switcher panel (live only) */}
      {isLive && (
        <ChannelSwitcher
          visible={channelSwitcherVisible}
          channels={liveChannels}
          activeStreamId={currentStreamId}
          isLoading={liveChannelsQuery.isPending}
          isOffline={isOffline}
          error={liveChannelsError}
          onRetry={retryLiveChannels}
          onSelectChannel={handleChannelSwitch}
          onClose={closeChannelSwitcher}
        />
      )}

      {/* {__DEV__ && isLive ? (
        <DevStreamDebugOverlay
          playerName={activePlayerName}
          requestUrl={player.currentSource.uri}
          sourceLabel={activeSourceLabel}
          isBuffering={player.isBuffering}
          isReconnecting={player.isReconnecting}
          reconnectAttempt={player.reconnectAttempt}
          lastFailureReason={player.lastFailureReason}
          debugEntries={player.debugEntries}
        />
      ) : null} */}
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
