import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Platform, StyleSheet } from 'react-native';
import Video, {
  type BufferConfig,
  type OnLoadData,
  type ReactVideoSource,
  type VideoRef,
} from 'react-native-video';

import type {
  PlaybackSource,
  PlayerAdapter,
  PlayerAdapterProps,
} from '../types/player';

interface NativeVideoPlayerProps extends PlayerAdapterProps {
  bufferConfig?: BufferConfig;
}

function createNativeSource(
  source: PlaybackSource,
  isLive: boolean,
  bufferConfig?: BufferConfig,
): ReactVideoSource {
  return {
    uri: source.uri,
    type: source.type,
    ...(Platform.OS === 'android' ? { bufferConfig } : {}),
    startPosition: isLive ? undefined : 0,
  };
}

const NativeVideoPlayer = forwardRef<PlayerAdapter, NativeVideoPlayerProps>(
  (
    {
      source,
      sourceToken,
      isLive,
      isPaused,
      bufferConfig,
      onLoad,
      onError,
      onProgress,
      onBuffer,
      resumePosition,
    },
    ref,
  ) => {
    const videoRef = useRef<VideoRef>(null);
    const pendingResumeRef = useRef(resumePosition);
    const sourceRef = useRef(source);
    const isLiveRef = useRef(isLive);
    const bufferConfigRef = useRef(bufferConfig);
    sourceRef.current = source;
    pendingResumeRef.current = resumePosition;
    isLiveRef.current = isLive;
    bufferConfigRef.current = bufferConfig;

    const replaceSource = useCallback(
      (nextSource: PlaybackSource, nextResumePosition = 0) => {
        pendingResumeRef.current = nextResumePosition;
        videoRef.current?.setSource(
          createNativeSource(
            nextSource,
            isLiveRef.current,
            bufferConfigRef.current,
          ),
        );
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        seek: timeSeconds => videoRef.current?.seek(timeSeconds),
        play: () => videoRef.current?.resume(),
        pause: () => videoRef.current?.pause(),
        stop: () => {
          videoRef.current?.pause();
          videoRef.current?.setSource(undefined);
        },
        replaceSource,
      }),
      [replaceSource],
    );

    useEffect(() => {
      replaceSource(sourceRef.current, pendingResumeRef.current);
    }, [replaceSource, sourceToken]);

    const handleLoad = useCallback(
      (data: OnLoadData) => {
        if (!isLive && pendingResumeRef.current > 0) {
          videoRef.current?.seek(pendingResumeRef.current);
        }
        onLoad({ duration: data.duration || 0 });
      },
      [isLive, onLoad],
    );

    return (
      <Video
        ref={videoRef}
        source={undefined}
        style={styles.video}
        fullscreenAutorotate
        fullscreenOrientation="landscape"
        enterPictureInPictureOnLeave
        controls={false}
        resizeMode="contain"
        paused={isPaused}
        onLoad={handleLoad}
        onError={onError}
        onProgress={onProgress}
        progressUpdateInterval={1000}
        onBuffer={onBuffer}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        automaticallyWaitsToMinimizeStalling
        preferredForwardBufferDuration={isLive ? 10 : 0}
      />
    );
  },
);

NativeVideoPlayer.displayName = 'NativeVideoPlayer';

export default React.memo(NativeVideoPlayer);

const styles = StyleSheet.create({
  video: {
    flex: 1,
  },
});
