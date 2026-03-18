// src/components/NativeVideoPlayer.tsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Video, {
    BufferConfig,
    OnBufferData,
    OnLoadData,
    OnVideoErrorData,
    ReactVideoSource,
} from 'react-native-video';

interface NativeVideoPlayerProps {
    uri: string;
    type?: string;
    isLive: boolean;
    isPaused: boolean;
    bufferConfig?: BufferConfig;
    onLoad: (data: OnLoadData) => void;
    onError: (error: OnVideoErrorData) => void;
    onProgress: (data: any) => void;
    onBuffer: (data: OnBufferData) => void;
    continueTime?: number;
}

export interface NativeVideoPlayerRef {
    seek: (time: number) => void;
}

const inferVideoType = (url: string): string | undefined => {
    const lower = (url || '').toLowerCase();
    if (lower.includes('.m3u8')) return 'm3u8';
    if (lower.includes('.mpd')) return 'mpd';
    if (lower.includes('.mp4')) return 'mp4';
    if (lower.includes('.ts')) return 'mpegts';
    return undefined;
};

const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, NativeVideoPlayerProps>(
    (
        {
            uri,
            type,
            isLive,
            isPaused,
            bufferConfig,
            onLoad,
            onError,
            onProgress,
            onBuffer,
            continueTime,
        },
        ref,
    ) => {
        const videoRef = useRef<any>(null);

        useImperativeHandle(ref, () => ({
            seek: (time: number) => {
                videoRef.current?.seek(time);
            },
        }));

        const handleLoad = (data: OnLoadData) => {
            if (continueTime && continueTime > 0) {
                videoRef.current?.seek(continueTime);
            }
            onLoad(data);
        };

        const source: ReactVideoSource = {
            uri,
            type: type || inferVideoType(uri),
            ...(Platform.OS === 'android'
                ? {
                    bufferConfig,
                    minLoadRetryCount: isLive ? 5 : 3,
                }
                : {}),
        };

        return (
            <Video
                ref={videoRef}
                source={source}
                style={styles.video}
                fullscreenAutorotate={true}
                fullscreenOrientation="landscape"
                enterPictureInPictureOnLeave={true}
                controls={false} // Using custom controls
                resizeMode="contain"
                paused={isPaused}
                onLoad={handleLoad}
                onError={onError}
                onProgress={onProgress}
                onBuffer={onBuffer}
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="ignore"
                automaticallyWaitsToMinimizeStalling={true}
                preferredForwardBufferDuration={isLive ? 10 : 0}
                maxBitRate={isLive ? 2500000 : 0}
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
