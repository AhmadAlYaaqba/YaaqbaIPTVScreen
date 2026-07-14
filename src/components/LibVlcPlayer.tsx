// src/components/LibVlcPlayer.tsx
// VLC engine wrapper using expo-libvlc-player (VLCKit 4 on iOS, libvlcjni on
// Android). Presents the same props/ref contract as the other engine wrappers
// (seconds externally, milliseconds internally) and shares PlayerControls.
import React, {
    forwardRef,
    useImperativeHandle,
    useRef,
    useEffect,
    useMemo,
} from 'react';
import { StyleSheet } from 'react-native';
import { LibVlcPlayerView } from 'expo-libvlc-player';
import type { LibVlcPlayerViewRef } from 'expo-libvlc-player';
import type { PlayerHandle } from '../types/player';

interface LibVlcPlayerProps {
    uri: string;
    isLive: boolean;
    isPaused: boolean;
    onLoad: (data: { duration: number }) => void;
    onError: (error: any) => void;
    onProgress: (data: { currentTime: number; seekableDuration: number }) => void;
    onBuffer: (data: { isBuffering: boolean }) => void;
    continueTime?: number;
}

export type LibVlcPlayerRef = PlayerHandle;

const LibVlcPlayer = forwardRef<LibVlcPlayerRef, LibVlcPlayerProps>(
    ({ uri, isLive, isPaused, onLoad, onError, onProgress, onBuffer, continueTime }, ref) => {
        const vlcRef = useRef<LibVlcPlayerViewRef>(null);
        const durationMsRef = useRef(0);
        const loadedRef = useRef(false);
        const lastProgressSecRef = useRef(-1);

        // libVLC media options are applied once at media creation; the screen
        // remounts this component per stream (key includes streamId), so the
        // live/VOD split here is always applied to the right media.
        const options = useMemo(
            () => (isLive ? [':network-caching=1500'] : [':network-caching=3000']),
            [isLive],
        );

        useImperativeHandle(ref, () => ({
            seek: (timeSeconds: number) => {
                vlcRef.current?.seek(Math.round(timeSeconds * 1000), 'time').catch(() => {});
            },
            play: () => {
                vlcRef.current?.play().catch(() => {});
            },
            pause: () => {
                vlcRef.current?.pause().catch(() => {});
            },
            stop: () => {
                vlcRef.current?.stop().catch(() => {});
            },
        }));

        // Stop playback when the player unmounts (e.g. navigating back), while
        // the ref is still attached — mirrors the previous VLC wrapper.
        useEffect(() => {
            return () => {
                vlcRef.current?.stop().catch(() => {});
            };
        }, []);

        // Sync playback with the declarative isPaused prop. autoplay covers the
        // initial state; skip until the media has actually opened so play/pause
        // commands don't race media creation.
        useEffect(() => {
            if (!loadedRef.current) {
                return;
            }
            if (isPaused) {
                vlcRef.current?.pause().catch(() => {});
            } else {
                vlcRef.current?.play().catch(() => {});
            }
        }, [isPaused]);

        return (
            <LibVlcPlayerView
                ref={vlcRef}
                style={styles.player}
                source={uri}
                options={options}
                autoplay
                repeat={false}
                mute={false}
                contentFit="contain"
                time={!isLive && continueTime && continueTime > 0 ? Math.round(continueTime * 1000) : 0}
                onFirstPlay={event => {
                    const { length } = event;
                    durationMsRef.current = length > 0 ? length : 0;
                    loadedRef.current = true;
                    onLoad({ duration: durationMsRef.current / 1000 });
                }}
                onTimeChanged={event => {
                    const timeMs = event.value || 0;
                    const timeSec = timeMs / 1000;
                    // Throttle bridge → JS state churn to ~1 update per second.
                    const wholeSec = Math.floor(timeSec);
                    if (wholeSec === lastProgressSecRef.current) {
                        return;
                    }
                    lastProgressSecRef.current = wholeSec;
                    onProgress({
                        currentTime: timeSec,
                        seekableDuration: durationMsRef.current / 1000,
                    });
                }}
                onBuffering={event => {
                    const progress = event.progress ?? 0;
                    onBuffer({ isBuffering: progress < 100 });
                }}
                onPlaying={() => {
                    onBuffer({ isBuffering: false });
                }}
                onPaused={() => {
                    onBuffer({ isBuffering: false });
                }}
                onStopped={() => {
                    onBuffer({ isBuffering: false });
                }}
                onEncounteredError={event => {
                    const message = event.message;
                    if (__DEV__) console.error('[LibVlc] Error:', message);
                    onError({ error: { errorString: message || 'VLC playback error' } });
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
