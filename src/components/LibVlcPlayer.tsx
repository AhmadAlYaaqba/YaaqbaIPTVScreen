import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet } from 'react-native';
import { LibVlcPlayerView } from 'expo-libvlc-player';
import type { LibVlcPlayerViewRef } from 'expo-libvlc-player';

import type {
  PlaybackSource,
  PlayerAdapter,
  PlayerAdapterProps,
} from '../types/player';

const LibVlcPlayer = forwardRef<PlayerAdapter, PlayerAdapterProps>(
  (
    {
      source,
      sourceToken,
      isLive,
      isPaused,
      onLoad,
      onError,
      onProgress,
      onBuffer,
      resumePosition,
    },
    ref,
  ) => {
    const vlcRef = useRef<LibVlcPlayerViewRef>(null);
    const durationMsRef = useRef(0);
    const loadedRef = useRef(false);
    const lastProgressSecRef = useRef(-1);
    const lastAppliedTokenRef = useRef(sourceToken);
    const sourceRef = useRef(source);
    const resumePositionRef = useRef(resumePosition);
    const [activeSource, setActiveSource] = useState(source);
    const [startTimeMs, setStartTimeMs] = useState(() =>
      !isLive && resumePosition > 0 ? Math.round(resumePosition * 1000) : 0,
    );
    sourceRef.current = source;
    resumePositionRef.current = resumePosition;

    const options = useMemo(
      () => (isLive ? [':network-caching=1500'] : [':network-caching=3000']),
      [isLive],
    );

    const replaceSource = useCallback(
      (nextSource: PlaybackSource, nextResumePosition = 0) => {
        loadedRef.current = false;
        durationMsRef.current = 0;
        lastProgressSecRef.current = -1;
        setStartTimeMs(
          !isLive && nextResumePosition > 0
            ? Math.round(nextResumePosition * 1000)
            : 0,
        );

        if (nextSource.uri !== activeSource.uri) {
          setActiveSource(nextSource);
          return;
        }

        // Same-source retries keep the React/native view mounted and ask VLC
        // to reopen the current media.
        vlcRef.current
          ?.stop()
          .then(() => vlcRef.current?.play())
          .catch(() => undefined);
      },
      [activeSource.uri, isLive],
    );

    useImperativeHandle(
      ref,
      () => ({
        seek: timeSeconds => {
          vlcRef.current
            ?.seek(Math.round(timeSeconds * 1000), 'time')
            .catch(() => undefined);
        },
        play: () => {
          vlcRef.current?.play().catch(() => undefined);
        },
        pause: () => {
          vlcRef.current?.pause().catch(() => undefined);
        },
        stop: () => {
          vlcRef.current?.stop().catch(() => undefined);
        },
        replaceSource,
      }),
      [replaceSource],
    );

    useEffect(() => {
      if (lastAppliedTokenRef.current === sourceToken) {
        return;
      }
      lastAppliedTokenRef.current = sourceToken;
      replaceSource(sourceRef.current, resumePositionRef.current);
    }, [replaceSource, sourceToken]);

    useEffect(() => {
      const player = vlcRef.current;
      return () => {
        player?.stop().catch(() => undefined);
      };
    }, []);

    useEffect(() => {
      if (!loadedRef.current) {
        return;
      }
      if (isPaused) {
        vlcRef.current?.pause().catch(() => undefined);
      } else {
        vlcRef.current?.play().catch(() => undefined);
      }
    }, [isPaused]);

    return (
      <LibVlcPlayerView
        ref={vlcRef}
        style={styles.player}
        source={activeSource.uri}
        options={options}
        autoplay
        repeat={false}
        mute={false}
        contentFit="contain"
        time={startTimeMs}
        onFirstPlay={event => {
          const { length } = event;
          durationMsRef.current = length > 0 ? length : 0;
          loadedRef.current = true;
          onLoad({ duration: durationMsRef.current / 1000 });
        }}
        onTimeChanged={event => {
          const timeMs = event.value || 0;
          const timeSec = timeMs / 1000;
          const wholeSecond = Math.floor(timeSec);
          if (wholeSecond === lastProgressSecRef.current) {
            return;
          }
          lastProgressSecRef.current = wholeSecond;
          onProgress({
            currentTime: timeSec,
            seekableDuration: durationMsRef.current / 1000,
          });
        }}
        onBuffering={event => {
          const progress = event.progress ?? 0;
          onBuffer({ isBuffering: progress < 100 });
        }}
        onPlaying={() => onBuffer({ isBuffering: false })}
        onPaused={() => onBuffer({ isBuffering: false })}
        onStopped={() => onBuffer({ isBuffering: false })}
        onEncounteredError={event => {
          onError({
            error: {
              errorString: event.message || 'VLC playback error',
            },
          });
        }}
      />
    );
  },
);

LibVlcPlayer.displayName = 'LibVlcPlayer';

export default React.memo(LibVlcPlayer);

const styles = StyleSheet.create({
  player: {
    flex: 1,
    backgroundColor: '#000',
  },
});
