// src/screens/VideoPlayerScreen.tsx
import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import Video, {OnLoadData, OnVideoErrorData} from 'react-native-video';
import {VLCPlayer, VlCPlayerView} from 'react-native-vlc-media-player';
import Orientation from 'react-native-orientation-locker';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../../RootNavigator'; // Adjust path to your stack params
import {useSelector} from 'react-redux';
import {RootState} from '../store';

type VideoPlayerScreenRouteProp = RouteProp<RootStackParamList, 'VideoPlayer'>;
type VideoPlayerScreenNavProp = StackNavigationProp<
  RootStackParamList,
  'VideoPlayer'
>;

interface Props {
  route: VideoPlayerScreenRouteProp;
  navigation: VideoPlayerScreenNavProp;
}

const VideoPlayerScreen: React.FC<Props> = ({route, navigation}) => {
  // streamUrl is passed from the previous screen
  const {streamUrl, channelName, isLive, title} = route.params;
  const videoRef = useRef<any>(null);
  const playerStatus = useSelector((state: RootState) => state.user.useVLC);

  const onLoad = (data: OnLoadData) => {
    console.log('Video loaded', data);
  };

  const onError = (error: OnVideoErrorData) => {
    console.log('Video error', error);
  };

  useEffect(() => {
    navigation.setOptions({headerShown: false});

    // Lock to landscape when the screen mounts
    Orientation.lockToLandscape();

    // Unlock when the screen unmounts
    return () => {
      Orientation.lockToPortrait() // or Orientation.lockToPortrait(); if you want to force portrait
    };
  }, [navigation]);

  console.log('rerendering ???');
  // Conditionally render based on platform and playerStatus
  if (Platform.OS !== 'android' && playerStatus) {
    return (
      <View style={styles.container}>
        <VlCPlayerView
          // autoplay={true}
          url={streamUrl}
          Orientation={"landscape"}

          // showGG={true}
          isLive={isLive}
          playInBackground={true}
          showTitle={!isLive}
          title={title}
          showBack={true}
          isFull={true}
          style={{flex: 1}}
          onLeftPress={() => {navigation.goBack()}}
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
        source={{uri: streamUrl, bufferConfig: {live: {targetOffsetMs: 500}}}}
        style={styles.video}
        fullscreenAutorotate={true}
        fullscreenOrientation="landscape"
        enterPictureInPictureOnLeave={true}
        // fullscreen={true}
        // Show built-in controls (play/pause/seek, etc.)
        controls={true}
        // Try "contain", "cover", or "stretch"
        resizeMode="contain"
        onLoad={onLoad}
        onError={onError}
        // Additional props you may want:
        // paused={false} // auto-play
        // bufferConfig={{...}}
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
