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

import {
  getPlayerContentFit,
  type PlaybackSource,
  type PlayerAdapter,
  type PlayerAdapterProps,
  type PlayerBufferEvent,
  type PlayerProgressEvent,
} from '../types/player';

interface NativeVideoPlayerProps extends PlayerAdapterProps {
  bufferConfig?: BufferConfig;
}

function createNativeSource(
  source: PlaybackSource,
  isLive: boolean,
  bufferConfig?: BufferConfig,
  resumePositionSeconds = 0,
): ReactVideoSource {
  return {
    uri: source.uri,
    type: source.type,
    ...(Platform.OS === 'android' ? { bufferConfig } : {}),
    // Milliseconds. Starting at the resume point directly avoids a flash of
    // the file's first frame plus a second buffering round-trip from a
    // post-load seek, on every resume and on every source retry.
    startPosition: isLive
      ? undefined
      : Math.max(0, Math.round(resumePositionSeconds * 1000)),
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
      onEnd,
      resumePosition,
      contentMode,
    },
    ref,
  ) => {
    const videoRef = useRef<VideoRef>(null);
    const pendingResumeRef = useRef(resumePosition);
    const sourceRef = useRef(source);
    const isLiveRef = useRef(isLive);
    const bufferConfigRef = useRef(bufferConfig);
    const encounteredErrorRef = useRef(false);
    sourceRef.current = source;
    pendingResumeRef.current = resumePosition;
    isLiveRef.current = isLive;
    bufferConfigRef.current = bufferConfig;

    const replaceSource = useCallback(
      (nextSource: PlaybackSource, nextResumePosition = 0) => {
        encounteredErrorRef.current = false;
        pendingResumeRef.current = nextResumePosition;
        videoRef.current?.setSource(
          createNativeSource(
            nextSource,
            isLiveRef.current,
            bufferConfigRef.current,
            nextResumePosition,
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
        encounteredErrorRef.current = false;
        onLoad({ duration: data.duration || 0 });
      },
      [onLoad],
    );

    const handleProgress = useCallback(
      (data: PlayerProgressEvent) => {
        encounteredErrorRef.current = false;
        onProgress(data);
      },
      [onProgress],
    );

    const handleBuffer = useCallback(
      (data: PlayerBufferEvent) => {
        if (!data.isBuffering && encounteredErrorRef.current) {
          return;
        }
        onBuffer(data);
      },
      [onBuffer],
    );

    const handleError = useCallback(
      (playerError: unknown) => {
        encounteredErrorRef.current = true;
        onError(playerError);
      },
      [onError],
    );

    return (
      <Video
        ref={videoRef}
        source={undefined}
        style={styles.video}
        fullscreenAutorotate
        fullscreenOrientation="landscape"
        controls={false}
        resizeMode={getPlayerContentFit('native', contentMode)}
        paused={isPaused}
        onLoad={handleLoad}
        onError={handleError}
        onProgress={handleProgress}
        progressUpdateInterval={1000}
        onBuffer={handleBuffer}
        onEnd={onEnd}
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
