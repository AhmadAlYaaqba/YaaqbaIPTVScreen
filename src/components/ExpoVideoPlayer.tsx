// src/components/ExpoVideoPlayer.tsx
// expo-video engine wrapper (AVPlayer on iOS, ExoPlayer/Media3 on Android via
// Expo's implementation). Same props/ref contract as the other engine
// wrappers; shares PlayerControls. All times in seconds.
import React, {
    forwardRef,
    useImperativeHandle,
    useRef,
    useEffect,
} from 'react';
import { StyleSheet } from 'react-native';
import {
    VideoView,
    useVideoPlayer as useExpoVideoPlayer,
} from 'expo-video';
import type { PlayerHandle } from '../types/player';

interface ExpoVideoPlayerProps {
    uri: string;
    isLive: boolean;
    isPaused: boolean;
    onLoad: (data: { duration: number }) => void;
    onError: (error: any) => void;
    onProgress: (data: { currentTime: number; seekableDuration: number }) => void;
    onBuffer: (data: { isBuffering: boolean }) => void;
    continueTime?: number;
}

export type ExpoVideoPlayerRef = PlayerHandle;

const ExpoVideoPlayer = forwardRef<ExpoVideoPlayerRef, ExpoVideoPlayerProps>(
    ({ uri, isLive, isPaused, onLoad, onError, onProgress, onBuffer, continueTime }, ref) => {
        const durationRef = useRef(0);
        const hasSeekedRef = useRef(false);

        const player = useExpoVideoPlayer(uri, p => {
            p.timeUpdateEventInterval = 1;
            p.play();
        });

        useImperativeHandle(ref, () => ({
            seek: (timeSeconds: number) => {
                player.currentTime = timeSeconds;
            },
            play: () => {
                player.play();
            },
            pause: () => {
                player.pause();
            },
            stop: () => {
                // expo-video releases the native player on unmount; pausing is
                // enough to silence audio the moment the screen blurs.
                player.pause();
            },
        }));

        // Event subscriptions. The player object is stable for a given source.
        useEffect(() => {
            const statusSub = player.addListener('statusChange', payload => {
                switch (payload.status) {
                    case 'loading':
                        onBuffer({ isBuffering: true });
                        break;
                    case 'readyToPlay':
                        onBuffer({ isBuffering: false });
                        break;
                    case 'error':
                        onBuffer({ isBuffering: false });
                        onError({
                            error: {
                                errorString:
                                    payload.error?.message || 'Playback error occurred',
                            },
                        });
                        break;
                }
            });

            const sourceLoadSub = player.addListener('sourceLoad', payload => {
                durationRef.current = payload.duration || 0;
                onLoad({ duration: durationRef.current });

                // Resume from saved progress once metadata is available.
                if (
                    !isLive &&
                    continueTime &&
                    continueTime > 0 &&
                    !hasSeekedRef.current
                ) {
                    hasSeekedRef.current = true;
                    player.currentTime = continueTime;
                }
            });

            const timeSub = player.addListener('timeUpdate', payload => {
                onProgress({
                    currentTime: payload.currentTime || 0,
                    seekableDuration: durationRef.current,
                });
            });

            const endSub = player.addListener('playToEnd', () => {
                onBuffer({ isBuffering: false });
                // The shared player hook detects completion via progress
                // reaching the end of the duration.
                if (!isLive && durationRef.current > 0) {
                    onProgress({
                        currentTime: durationRef.current,
                        seekableDuration: durationRef.current,
                    });
                }
            });

            return () => {
                statusSub.remove();
                sourceLoadSub.remove();
                timeSub.remove();
                endSub.remove();
            };
        }, [player, isLive, continueTime, onLoad, onError, onProgress, onBuffer]);

        // Sync with the declarative isPaused prop.
        useEffect(() => {
            if (isPaused) {
                player.pause();
            } else {
                player.play();
            }
        }, [player, isPaused]);

        return (
            <VideoView
                style={styles.player}
                player={player}
                nativeControls={false}
                contentFit="contain"
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
