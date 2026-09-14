import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet } from 'react-native';
import {
  VideoView,
  useVideoPlayer as useExpoVideoPlayer,
  type VideoSource,
} from 'expo-video';

import type {
  PlaybackSource,
  PlayerAdapter,
  PlayerAdapterProps,
} from '../types/player';
import { getPlayerContentFit } from '../types/player';
import { getExpoPlaybackContentType } from '../utils/playbackSources';

function createExpoSource(source: PlaybackSource): VideoSource {
  return {
    uri: source.uri,
    contentType: getExpoPlaybackContentType(source),
  };
}

const ExpoVideoPlayer = forwardRef<PlayerAdapter, PlayerAdapterProps>(
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
      onEnd,
      resumePosition,
      contentMode,
    },
    ref,
  ) => {
    const durationRef = useRef(0);
    const sourceReadyRef = useRef(false);
    const pendingResumeRef = useRef(resumePosition);
    const sourceRef = useRef(source);
    const generationRef = useRef(0);
    const replacementQueueRef = useRef<Promise<void>>(Promise.resolve());
    const isLiveRef = useRef(isLive);
    const isPausedRef = useRef(isPaused);
    const onLoadRef = useRef(onLoad);
    const onErrorRef = useRef(onError);
    const onProgressRef = useRef(onProgress);
    const onBufferRef = useRef(onBuffer);
    const onEndRef = useRef(onEnd);

    sourceRef.current = source;
    pendingResumeRef.current = resumePosition;
    isLiveRef.current = isLive;
    isPausedRef.current = isPaused;
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
    onProgressRef.current = onProgress;
    onBufferRef.current = onBuffer;
    onEndRef.current = onEnd;

    // The player is created once. Sources are replaced through this instance.
    const player = useExpoVideoPlayer(null, nextPlayer => {
      nextPlayer.timeUpdateEventInterval = 1;
    });

    const replaceSource = useCallback(
      (nextSource: PlaybackSource, nextResumePosition = 0) => {
        const generation = ++generationRef.current;
        sourceRef.current = nextSource;
        pendingResumeRef.current = nextResumePosition;
        durationRef.current = 0;
        sourceReadyRef.current = false;
        onBufferRef.current({ isBuffering: true });

        const replacement = replacementQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            if (generation !== generationRef.current) {
              return;
            }
            await player.replaceAsync(createExpoSource(nextSource));
            if (generation !== generationRef.current) {
              return;
            }
            if (isPausedRef.current) {
              player.pause();
            } else {
              player.play();
            }
          });

        replacementQueueRef.current = replacement.catch(error => {
          if (generation === generationRef.current) {
            onBufferRef.current({ isBuffering: false });
            onErrorRef.current(error);
          }
        });
        return replacementQueueRef.current;
      },
      [player],
    );

    useImperativeHandle(
      ref,
      () => ({
        seek: timeSeconds => {
          player.currentTime = timeSeconds;
        },
        play: () => player.play(),
        pause: () => player.pause(),
        stop: () => player.pause(),
        replaceSource,
      }),
      [player, replaceSource],
    );

    useEffect(() => {
      replaceSource(sourceRef.current, pendingResumeRef.current);
    }, [replaceSource, sourceToken]);

    useEffect(() => {
      const statusSubscription = player.addListener('statusChange', payload => {
        switch (payload.status) {
          case 'loading':
            onBufferRef.current({ isBuffering: true });
            break;
          case 'readyToPlay':
            onBufferRef.current({ isBuffering: false });
            break;
          case 'error':
            onBufferRef.current({ isBuffering: false });
            onErrorRef.current({
              error: {
                errorString:
                  payload.error?.message || 'Playback error occurred',
              },
            });
            break;
        }
      });

      const sourceLoadSubscription = player.addListener(
        'sourceLoad',
        payload => {
          durationRef.current = payload.duration || 0;
          sourceReadyRef.current = true;
          if (!isLiveRef.current && pendingResumeRef.current > 0) {
            player.currentTime = pendingResumeRef.current;
          }
          onLoadRef.current({ duration: durationRef.current });
        },
      );

      const timeSubscription = player.addListener('timeUpdate', payload => {
        const currentDuration = Number(player.duration);
        if (Number.isFinite(currentDuration) && currentDuration > 0) {
          durationRef.current = currentDuration;
        }
        onProgressRef.current({
          currentTime: payload.currentTime || 0,
          seekableDuration: durationRef.current,
        });
      });

      const endSubscription = player.addListener('playToEnd', () => {
        onBufferRef.current({ isBuffering: false });
        if (!isLiveRef.current && durationRef.current > 0) {
          onProgressRef.current({
            currentTime: durationRef.current,
            seekableDuration: durationRef.current,
          });
        }
        if (!isLiveRef.current && sourceReadyRef.current) {
          onEndRef.current();
        }
      });

      return () => {
        statusSubscription.remove();
        sourceLoadSubscription.remove();
        timeSubscription.remove();
        endSubscription.remove();
      };
    }, [player]);

    useEffect(() => {
      if (isPaused) {
        player.pause();
      } else if (player.status === 'readyToPlay') {
        player.play();
      }
    }, [isPaused, player]);

    useEffect(
      () => () => {
        generationRef.current += 1;
      },
      [],
    );

    return (
      <VideoView
        style={styles.player}
        player={player}
        nativeControls={false}
        contentFit={getPlayerContentFit('expo-video', contentMode)}
        allowsPictureInPicture={false}
      />
    );
  },
);

ExpoVideoPlayer.displayName = 'ExpoVideoPlayer';

export default React.memo(ExpoVideoPlayer);

const styles = StyleSheet.create({
  player: {
    flex: 1,
    backgroundColor: '#000',
  },
});
