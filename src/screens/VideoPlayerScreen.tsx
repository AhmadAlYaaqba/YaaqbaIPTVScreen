import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../RootNavigator';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { storage } from '../utils/storage';
import { unwrapProxyUrl, proxyStreamUrl } from '../utils/proxy';
import { buildSeriesStreamUrl } from '../utils/xtream';

// Components
import NativeVideoPlayer, { NativeVideoPlayerRef } from '../components/NativeVideoPlayer';
import VLCPlyrPlayer, { VLCPlyrPlayerRef } from '../components/VLCPlyrPlayer';
import PlayerControls from '../components/PlayerControls';
import ChannelSwitcher from '../components/ChannelSwitcher';
// import DevStreamDebugOverlay from '../components/DevStreamDebugOverlay';


// Hooks
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { usePlayerGestures } from '../hooks/usePlayerGestures';

type VideoPlayerScreenRouteProp = RouteProp<RootStackParamList, 'VideoPlayer'>;
type VideoPlayerScreenNavProp = StackNavigationProp<RootStackParamList, 'VideoPlayer'>;

type Props = {
  route: VideoPlayerScreenRouteProp;
  navigation: VideoPlayerScreenNavProp;
};

// Extract original URL from proxy URL for VLC (VLC handles IPTV streams natively)
const getDirectStreamUrl = (url: string): string => unwrapProxyUrl(url);

const CONTROLS_TIMEOUT = 5000; // Auto-hide controls after 5 seconds

const VideoPlayerScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    streamUrl: initialStreamUrl,
    channelName: initialChannelName,
    isLive = false,
    title,
    seriesId,
    episodeId,
    episodeList,
    currentEpisodeIndex,
    movieId,
    continueTime,
    thumbnail = '',
  } = route.params;

  const { useVLC, useProxy, username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );
  // Get channels for current category from Redux
  const liveChannels = useSelector((state: RootState) => state.iptv.liveChannels);

  // Current stream (can change when switching channels)
  const [currentStreamUrl, setCurrentStreamUrl] = useState(initialStreamUrl);
  const [currentChannelName, setCurrentChannelName] = useState(initialChannelName || title || '');
  const [currentStreamId, setCurrentStreamId] = useState(() => {
    const match = initialStreamUrl.match(/\/(\d+)\.m3u8/);
    return match?.[1] || '';
  });

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Channel switcher
  const [channelSwitcherVisible, setChannelSwitcherVisible] = useState(false);

  // Video player hook (native player logic)
  const player = useVideoPlayer({
    originalStreamUrl: currentStreamUrl,
    serverDomain,
    serverPort,
    username,
    password,
    streamId: currentStreamId,
    isLive,
    useProxy,
    autoReconnect: true,
    maxRetries: 10,
  });

  // Player refs
  const nativePlayerRef = useRef<NativeVideoPlayerRef>(null);
  const vlcPlyrRef = useRef<VLCPlyrPlayerRef>(null);

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
      if (useVLC) {
        vlcPlyrRef.current?.seek(time);
      } else {
        nativePlayerRef.current?.seek(time);
      }
      resetControlsTimeout();
    },
    [useVLC, resetControlsTimeout],
  );

  // Gesture hook (brightness, seek)
  const gestures = usePlayerGestures({
    isLive,
    duration: player.duration,
    onSeek: handleSeek,
  });

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
        // VLC needs an explicit stop; the native (ExoPlayer) view already stops
        // itself via playInBackground={false} + the isPaused prop.
        vlcPlyrRef.current?.stop();
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
  }, [isLive, player.duration, saveProgress]);

  // --- Auto-play next episode ---
  useEffect(() => {
    if (player.isCompleted) {
      if (seriesId && episodeList && currentEpisodeIndex !== undefined) {
        const nextEpisodeIndex = currentEpisodeIndex + 1;
        if (nextEpisodeIndex < episodeList.length) {
          const nextEpisode = episodeList[nextEpisodeIndex];
          const ext = nextEpisode.container_extension?.replace('.', '') || 'mp4';
          const originalNextUrl = buildSeriesStreamUrl({
            domain: serverDomain,
            port: serverPort,
            username,
            password,
            streamId: nextEpisode.id,
            extension: ext,
          });
          const nextUrl = proxyStreamUrl(originalNextUrl, useProxy);

          navigation.replace('VideoPlayer', {
            streamUrl: nextUrl,
            isLive: false,
            title: nextEpisode.title,
            seriesId,
            episodeId: nextEpisode.id,
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
  }, [player.isCompleted]);

  // --- Recently watched tracking ---
  useEffect(() => {
    if (!isLive && (seriesId || movieId)) {
      storage.saveRecentlyWatched({
        id: seriesId || movieId || '',
        type: seriesId ? 'series' : 'movie',
        name: title || '',
        timestamp: Date.now(),
        progress: 0,
        totalDuration: player.duration,
        seriesId,
        episodeId,
        thumbnail,
      });
      storage.saveLatestWatched({
        id: seriesId || movieId || '',
        type: seriesId ? 'series' : 'movie',
        name: title || '',
        timestamp: Date.now(),
        progress: 0,
        totalDuration: player.duration,
        seriesId,
        episodeId,
        thumbnail,
      });
    } else if (isLive && currentChannelName) {
      storage.saveLatestWatched({
        id: currentStreamUrl,
        type: 'live',
        name: currentChannelName,
        timestamp: Date.now(),
        channelName: currentChannelName,
        thumbnail,
      });
    }
  }, []);

  // --- Channel switch ---
  const handleChannelSwitch = useCallback(
    (newStreamUrl: string, newChannelName: string, newStreamId: string) => {
      setCurrentStreamUrl(newStreamUrl);
      setCurrentChannelName(newChannelName);
      setCurrentStreamId(newStreamId);
      setChannelSwitcherVisible(false);
      // The player hook will re-run with new URL since state changed
    },
    [],
  );

  const toggleChannelSwitcher = useCallback(() => {
    setChannelSwitcherVisible(v => !v);
  }, []);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const activeRequestUrl = useVLC
    ? (useProxy ? currentStreamUrl : getDirectStreamUrl(currentStreamUrl))
    : player.currentSource?.uri || currentStreamUrl;

  const activeSourceLabel = useVLC
    ? `VLCPlyr${useProxy ? ' (proxied)' : ' (direct)'}`
    : player.currentSource?.label;

  const activePlayerName = useVLC ? 'VLCPlyr' : 'NativeVideo';

  // --- Render ---
  if (__DEV__) {
    console.log('[VideoPlayerScreen] render, useVLC:', useVLC, 'url:', useProxy ? currentStreamUrl : getDirectStreamUrl(currentStreamUrl));
  }

  return (
    <View style={styles.container}>
      {/* Video player */}
      {useVLC ? (
        // VLC player — raw surface, uses shared PlayerControls
        <VLCPlyrPlayer
          key={`vlcplyr-${player.playerKey}-${currentStreamId}`}
          ref={vlcPlyrRef}
          uri={useProxy ? currentStreamUrl : getDirectStreamUrl(currentStreamUrl)}
          isLive={isLive}
          isPaused={player.isPaused}
          onLoad={player.onLoad}
          onError={player.onError}
          onProgress={player.onProgress}
          onBuffer={player.onBuffer}
          continueTime={continueTime?.progress}
        />
      ) : (
        // ExoPlayer (native)
        player.currentSource && (
          <NativeVideoPlayer
            key={`native-${player.playerKey}-${currentStreamId}`}
            ref={nativePlayerRef}
            uri={player.currentSource.uri}
            type={player.currentSource.type}
            isLive={isLive}
            isPaused={player.isPaused}
            bufferConfig={player.bufferConfig}
            onLoad={player.onLoad}
            onError={player.onError}
            onProgress={player.onProgress}
            onBuffer={player.onBuffer}
            continueTime={continueTime?.progress}
          />
        )
      )}

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
        onTogglePlayPause={player.togglePlayPause}
        onGoBack={handleGoBack}
        onSeek={handleSeek}
        onRetry={player.retry}
        onToggleVisibility={toggleControls}
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
          activeStreamUrl={currentStreamUrl}
          serverDomain={serverDomain}
          serverPort={serverPort}
          username={username}
          password={password}
          useProxy={useProxy}
          onSelectChannel={handleChannelSwitch}
          onClose={() => setChannelSwitcherVisible(false)}
        />
      )}

      {/* {__DEV__ && isLive && activeRequestUrl ? (
        <DevStreamDebugOverlay
          playerName={activePlayerName}
          requestUrl={activeRequestUrl}
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
