// src/components/VLCPlyrPlayer.tsx
// New VLC player wrapper using rn-vlc-plyr (v0.2.9-beta.3+).
// Shares the same PlayerControls as ExoPlayer for unified look.
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { RnVlcPlyr } from 'rn-vlc-plyr';
import type { RnVlcPlyrHandlers } from 'rn-vlc-plyr';

interface VLCPlyrPlayerProps {
    uri: string;
    isLive: boolean;
    isPaused: boolean;
    onLoad: (data: { duration: number }) => void;
    onError: (error: any) => void;
    onProgress: (data: { currentTime: number; seekableDuration: number }) => void;
    onBuffer: (data: { isBuffering: boolean }) => void;
    continueTime?: number;
}

export interface VLCPlyrPlayerRef {
    seek: (timeSeconds: number) => void;
    play: () => void;
    pause: () => void;
}

const VLCPlyrPlayer = forwardRef<VLCPlyrPlayerRef, VLCPlyrPlayerProps>(
    ({ uri, isLive, isPaused, onLoad, onError, onProgress, onBuffer, continueTime }, ref) => {
        const vlcRef = useRef<RnVlcPlyrHandlers>(null);
        const hasSeekedRef = useRef(false);

        // Expose play, pause, seek to parent via ref
        useImperativeHandle(ref, () => ({
            seek: (timeSeconds: number) => {
                vlcRef.current?.seek(Math.round(timeSeconds * 1000));
            },
            play: () => {
                if (__DEV__) console.log('[VLCPlyr] ref.play() called');
                vlcRef.current?.play();
            },
            pause: () => {
                if (__DEV__) console.log('[VLCPlyr] ref.pause() called');
                vlcRef.current?.pause();
            },
        }));

        // Sync local playback state with the declarative isPaused prop.
        useEffect(() => {
            if (isPaused) {
                if (__DEV__) console.log('[VLCPlyr] Prop changed to paused, calling pause()');
                vlcRef.current?.pause();
            } else {
                if (__DEV__) console.log('[VLCPlyr] Prop changed to playing, calling play()');
                vlcRef.current?.play();
            }
        }, [isPaused]);

        return (
            <RnVlcPlyr
                ref={vlcRef}
                style={styles.player}
                url={uri}
                autoPlay={true}
                loop={false}
                muted={false}
                onLoad={(event: any) => {
                    const data = event.nativeEvent;
                    onLoad({ duration: data.duration || 0 });

                    // Seek to continue position after load
                    if (continueTime && continueTime > 0 && !hasSeekedRef.current) {
                        hasSeekedRef.current = true;
                        setTimeout(() => {
                            vlcRef.current?.seek(Math.round(continueTime * 1000));
                        }, 200);
                    }
                }}
                onProgress={(event: any) => {
                    const data = event.nativeEvent;
                    onProgress({
                        currentTime: data.currentTime || 0,
                        seekableDuration: data.duration || 0,
                    });
                }}
                onStateChange={(event: any) => {
                    const state = event.nativeEvent.state;
                    if (__DEV__) console.log('[VLCPlyr] State:', state);

                    switch (state) {
                        case 'buffering':
                            onBuffer({ isBuffering: true });
                            break;
                        case 'playing':
                            onBuffer({ isBuffering: false });
                            break;
                        case 'paused':
                        case 'stopped':
                            onBuffer({ isBuffering: false });
                            break;
                        case 'error':
                            onError({ error: { errorString: 'VLC playback error' } });
                            break;
                        case 'ended':
                            onBuffer({ isBuffering: false });
                            break;
                    }
                }}
                onError={(event: any) => {
                    const data = event.nativeEvent;
                    if (__DEV__) console.error('[VLCPlyr] Error:', data.message, 'Code:', data.code);
                    onError({ error: { errorString: data.message || 'Unknown VLC error' } });
                }}
            />
        );
    },
);

VLCPlyrPlayer.displayName = 'VLCPlyrPlayer';

export default React.memo(VLCPlyrPlayer);

const styles = StyleSheet.create({
    player: {
        flex: 1,
        backgroundColor: '#000',
    },
});
