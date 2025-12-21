// src/screens/VideoPlayerScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import Video, { OnLoadData, OnVideoErrorData } from 'react-native-video';
import { VLCPlayer, VlCPlayerView } from 'react-native-vlc-media-player';
import Orientation from 'react-native-orientation-locker';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../RootNavigator'; // Adjust path to your stack params
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { storage } from '../utils/storage';

const inferVideoType = (url: string): string | undefined => {
  const lower = (url || '').toLowerCase();

  // Important: our proxy URLs look like `/api/stream?url=http.../file.m3u8`
  // so ExoPlayer can't infer HLS from the path. We force the type here.
  if (lower.includes('.m3u8')) return 'm3u8';
  if (lower.includes('.mpd')) return 'mpd'; // DASH (if you ever proxy it)
  if (lower.includes('.mp4')) return 'mp4';

  return undefined;
};

type VideoPlayerScreenRouteProp = RouteProp<RootStackParamList, 'VideoPlayer'>;

// Update the RootStackParamList type in your RootNavigator.tsx to include these params
interface VideoPlayerParams {
  streamUrl: string;
  channelName?: string;
  isLive?: boolean;
  title?: string;
  seriesId?: string;
  episodeId?: string;
  episodeList?: any[];
  currentEpisodeIndex?: number;
  movieId?: string;
}

type VideoPlayerScreenNavProp = StackNavigationProp<
  RootStackParamList,
  'VideoPlayer'
>;

interface Props {
  route: VideoPlayerScreenRouteProp;
  navigation: VideoPlayerScreenNavProp;
}

const VideoPlayerScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    streamUrl,
    channelName,
    isLive,
    title,
    seriesId,
    episodeId,
    episodeList,
    currentEpisodeIndex,
    movieId,
    continueTime,
    thumbnail = '',
  } = route.params;
  const videoRef = useRef<any>(null);
  const playerStatus = useSelector((state: RootState) => state.user.useVLC);
  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );

  const [duration, setDuration] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const currentProgressRef = useRef(0);
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Save progress to storage
  const saveProgress = async (currentProgress: number) => {
    if (isLive) return;

    const contentId = episodeId || movieId;
    if (!contentId || currentProgress <= 0) return;

    await storage.saveWatchProgress(
      {
        contentId,
        progress: currentProgress,
        timestamp: Date.now(),
        totalDuration: duration,
        title: title || '',
        seriesId,
        episodeId,
      },
      !!movieId,
    );
  };

  // Setup interval-based progress saving (every 30 seconds)
  useEffect(() => {
    if (isLive) return;

    progressSaveIntervalRef.current = setInterval(() => {
      if (currentProgressRef.current > 0 && duration > 0) {
        saveProgress(currentProgressRef.current);
      }
    }, 30000); // Save every 30 seconds

    return () => {
      // Save progress on unmount
      if (currentProgressRef.current > 0) {
        saveProgress(currentProgressRef.current);
      }
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
    };
  }, [isLive, duration, episodeId, movieId, seriesId, title]);

  // Handle video progress
  const onProgress = (data: any) => {
    if (isLive) return;

    const currentProgress = data.currentTime;
    currentProgressRef.current = currentProgress;

    // Check if video is completed (within last 5 seconds)
    if (duration > 0 && currentProgress >= duration - 5) {
      setIsCompleted(true);
    }
  };

  // Handle video completion
  useEffect(() => {
    if (isCompleted) {
      if (seriesId && episodeList && currentEpisodeIndex !== undefined) {
        const nextEpisodeIndex = currentEpisodeIndex + 1;

        if (nextEpisodeIndex < episodeList.length) {
          // Auto-play next episode
          const nextEpisode = episodeList[nextEpisodeIndex];
          const ext =
            nextEpisode.container_extension?.replace('.', '') || 'mp4';
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
          // Series completed
          storage.clearWatchProgress(seriesId, false, seriesId, episodeId);
          navigation.goBack();
        }
      } else if (movieId) {
        // Movie completed
        storage.clearWatchProgress(movieId, true);
        navigation.goBack();
      }
    }
  }, [isCompleted]);

  // Save to recently watched when component mounts
  useEffect(() => {
    if (!isLive && (seriesId || movieId)) {
      // Save to recently watched (all episodes)
      storage.saveRecentlyWatched({
        id: seriesId || movieId || '',
        type: seriesId ? 'series' : 'movie',
        name: title || '',
        timestamp: Date.now(),
        progress: 0,
        totalDuration: duration,
        seriesId,
        episodeId,
        thumbnail, // You can add thumbnail if available
      });

      // Save to latest watched (only latest episode per series)
      storage.saveLatestWatched({
        id: seriesId || movieId || '',
        type: seriesId ? 'series' : 'movie',
        name: title || '',
        timestamp: Date.now(),
        progress: 0,
        totalDuration: duration,
        seriesId,
        episodeId,
        thumbnail, // You can add thumbnail if available
      });
    } else if (isLive && channelName) {
      // Save live stream to latest watched only
      storage.saveLatestWatched({
        id: streamUrl,
        type: 'live',
        name: channelName,
        timestamp: Date.now(),
        channelName,
        thumbnail, // You can add thumbnail if available
      });
    }
  }, []);

  const onLoad = (data: OnLoadData) => {
    if (__DEV__) console.log('Video loaded', data, continueTime);
    setDuration(data.duration);
    if (continueTime?.progress) videoRef.current.seek(continueTime.progress);
  };

  const onError = (error: OnVideoErrorData) => {
    if (__DEV__) console.log('Video error', error);
    Alert.alert(`Video Error ${JSON.stringify(error.error)}`);
  };

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    // Lock to landscape when the screen mounts
    Orientation.lockToLandscape();

    // Unlock when the screen unmounts
    return () => {
      Orientation.lockToPortrait(); // or Orientation.lockToPortrait(); if you want to force portrait
    };
  }, [navigation]);

  if (__DEV__) console.log('VideoPlayer render, useVLC:', playerStatus);
  
  // Conditionally render based on playerStatus (user preference for VLC)
  // Note: VLC may have issues on some Android devices - users can toggle in Settings
  if (playerStatus) {
    return (
      <View style={styles.container}>
        <VlCPlayerView
          url={streamUrl}
          Orientation={'landscape'}
          isLive={isLive}
          playInBackground={true}
          showTitle={!isLive}
          title={title}
          showBack={true}
          isFull={true}
          style={{ flex: 1 }}
          onLeftPress={() => {
            navigation.goBack();
          }}
          onProgress={onProgress}
        />
        {/* <VLCPlayer
          style={[styles.video]}
          videoAspectRatio="16:9"
          source={{
            uri: streamUrl,
          }}
        /> */}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{
          uri: streamUrl,
          type: inferVideoType(streamUrl),
        }}
        bufferConfig={{
          minBufferMs: 15000,
          maxBufferMs: 50000,
          bufferForPlaybackMs: 2500,
          bufferForPlaybackAfterRebufferMs: 5000,
          ...(isLive && {
            live: {
              targetOffsetMs: 3000,
            },
          }),
        }}
        style={styles.video}
        fullscreenAutorotate={true}
        fullscreenOrientation="landscape"
        enterPictureInPictureOnLeave={true}
        controls={true}
        resizeMode="contain"
        onLoad={onLoad}
        onError={onError}
        onProgress={onProgress}
      />
    </View>
  );
};

export default VideoPlayerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  video: {
    flex: 1,
  },
});
