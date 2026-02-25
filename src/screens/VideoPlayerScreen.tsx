// src/screens/VideoPlayerScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../RootNavigator';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { storage } from '../utils/storage';

// Components
import NativeVideoPlayer, { NativeVideoPlayerRef } from '../components/NativeVideoPlayer';
import VLCVideoPlayer, { VLCVideoPlayerRef } from '../components/VLCVideoPlayer';
import PlayerControls from '../components/PlayerControls';

// Hooks
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { usePlayerGestures } from '../hooks/usePlayerGestures';

type VideoPlayerScreenRouteProp = RouteProp<RootStackParamList, 'VideoPlayer'>;
type VideoPlayerScreenNavProp = StackNavigationProp<RootStackParamList, 'VideoPlayer'>;

interface Props {
  route: VideoPlayerScreenRouteProp;
  navigation: VideoPlayerScreenNavProp;
}

const CONTROLS_TIMEOUT = 5000; // Auto-hide controls after 5 seconds

const VideoPlayerScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    streamUrl,
    channelName,
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

  const useVLC = useSelector((state: RootState) => state.user.useVLC);
  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract stream_id from URL for multi-source fallback
  const streamIdMatch = streamUrl.match(/\/(\d+)\.m3u8/);
  const streamId = streamIdMatch?.[1] || '';

  // Video player hook (native player logic)
  const player = useVideoPlayer({
    originalStreamUrl: streamUrl,
    serverDomain,
    serverPort,
    username,
    password,
    streamId,
    isLive,
    autoReconnect: true,
    maxRetries: 10,
  });

  // Gesture hook (brightness, seek)
  const gestures = usePlayerGestures({
    isLive,
    duration: player.duration,
    onSeek: player.seek,
  });

  // Refs for player components
  const nativePlayerRef = useRef<NativeVideoPlayerRef>(null);
  const vlcPlayerRef = useRef<VLCVideoPlayerRef>(null);

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

  // Show controls initially, then auto-hide
  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

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
  }, [player.isPaused, player.error, player.isReconnecting]);

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




  // --- Progress saving (for VOD) ---
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const saveProgress = useCallback(
    async (currentProgress: number) => {
      if (isLive) return;
      const contentId = episodeId || movieId;
      if (!contentId || currentProgress <= 0) return;

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
    if (isLive) return;

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
          const originalNextUrl = `http://${serverDomain}:${serverPort}/series/${username}/${password}/${nextEpisode.id}.${ext}`;
          const nextUrl = `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(originalNextUrl)}`;

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
    } else if (isLive && channelName) {
      storage.saveLatestWatched({
        id: streamUrl,
        type: 'live',
        name: channelName,
        timestamp: Date.now(),
        channelName,
        thumbnail,
      });
    }
  }, []);

  // --- Seek ---
  const handleSeek = useCallback(
    (time: number) => {
      if (useVLC) {
        vlcPlayerRef.current?.seek(time);
      } else {
        nativePlayerRef.current?.seek(time);
      }
      resetControlsTimeout();
    },
    [useVLC, resetControlsTimeout],
  );

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // --- Render ---
  if (__DEV__) console.log('[VideoPlayerScreen] render, useVLC:', useVLC);

  return (
    <View style={styles.container}>
      {/* Video player */}
      {useVLC ? (
        <VLCVideoPlayer
          ref={vlcPlayerRef}
          uri={streamUrl}
          isLive={isLive}
          title={title}
          onGoBack={handleGoBack}
          onProgress={player.onProgress}
        />
      ) : (
        player.currentSource && (
          <NativeVideoPlayer
            key={`native-${player.playerKey}`}
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

      {/* Custom controls overlay (native player only — VLC has its own) */}
      {!useVLC && (
        <PlayerControls
          visible={controlsVisible}
          channelName={channelName || title}
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
          onVerticalPanStart={gestures.onVerticalPanStart}
          onVerticalPanMove={gestures.onVerticalPanMove}
          onVerticalPanEnd={gestures.onVerticalPanEnd}
        />
      )}
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
