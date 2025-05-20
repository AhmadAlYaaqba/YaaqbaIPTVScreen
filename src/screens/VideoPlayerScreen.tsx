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
  } = route.params;
  const videoRef = useRef<any>(null);
  const playerStatus = useSelector((state: RootState) => state.user.useVLC);
  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );

  const [duration, setDuration] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Save progress periodically
  const saveProgress = async (currentProgress: number) => {
    if (isLive) return;

    const contentId = episodeId || movieId;
    if (!contentId) return;

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

  // Handle video progress
  const onProgress = (data: any) => {
    if (isLive) return;

    const currentProgress = data.currentTime;

    // Save progress every 30 seconds
    if (currentProgress % 30 < 1) {
      saveProgress(currentProgress);
    }

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
          const nextUrl = `http://${serverDomain}:${serverPort}/series/${username}/${password}/${nextEpisode.id}.${ext}`;

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
      storage.saveRecentlyWatched({
        id: seriesId || movieId || '',
        type: seriesId ? 'series' : 'movie',
        name: title || '',
        timestamp: Date.now(),
      });
    }
  }, []);

  const onLoad = (data: OnLoadData) => {
    console.log('Video loaded', data, continueTime);
    setDuration(data.duration);
    if (continueTime?.progress) videoRef.current.seek(continueTime.progress);
  };

  const onError = (error: OnVideoErrorData) => {
    console.log('Video error', error);
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

  console.log('rerendering ???');
  // Conditionally render based on platform and playerStatus
  if (Platform.OS !== 'android' && playerStatus) {
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
          bufferConfig: { live: { targetOffsetMs: 500 } },
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
        currentPlaybackTime={180}
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
