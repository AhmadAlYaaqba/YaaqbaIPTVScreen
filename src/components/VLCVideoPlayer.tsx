// src/components/VLCVideoPlayer.tsx
import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import { VlCPlayerView } from 'react-native-vlc-media-player';

interface VLCVideoPlayerProps {
    uri: string;
    isLive: boolean;
    title?: string;
    onGoBack: () => void;
    onProgress?: (data: any) => void;
    onError?: (error: any) => void;
    onBuffering?: (data: any) => void;
    onLoad?: (data: any) => void;
}

export interface VLCVideoPlayerRef {
    seek: (time: number) => void;
}

const VLCVideoPlayer = forwardRef<VLCVideoPlayerRef, VLCVideoPlayerProps>(
    ({ uri, isLive, title, onGoBack, onProgress, onError, onBuffering, onLoad }, ref) => {
        useImperativeHandle(ref, () => ({
            seek: (_time: number) => {
                // VlCPlayerView doesn't expose a clean seek API externally
                // This is a known limitation of the VLC wrapper
                if (__DEV__) console.log('[VLCPlayer] Seek not fully supported in VlCPlayerView');
            },
        }));

        return (
            <VlCPlayerView
                url={uri}
                Orientation="landscape"
                isLive={isLive}
                playInBackground={true}
                showTitle={!isLive}
                title={title}
                showBack={true}
                isFull={true}
                style={styles.player}
                initOptions={[
                    '--network-caching=3000',
                    '--live-caching=3000',
                    '--file-caching=3000',
                ]}
                onLeftPress={onGoBack}
                onProgress={onProgress}
                onError={onError}
                onIsPlaying={(data: any) => {
                    // VLC's version of onLoad
                    if (data?.isPlaying) {
                        onLoad?.({ duration: data.duration || 0 });
                    }
                }}
                onBuffering={onBuffering}
            />
        );
    },
);

VLCVideoPlayer.displayName = 'VLCVideoPlayer';

export default React.memo(VLCVideoPlayer);

const styles = StyleSheet.create({
    player: {
        flex: 1,
    },
});
