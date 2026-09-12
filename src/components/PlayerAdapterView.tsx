import React, { forwardRef } from 'react';
import type { BufferConfig } from 'react-native-video';

import type {
  PlayerAdapter,
  PlayerAdapterProps,
  PlayerEngine,
} from '../types/player';
import ExpoVideoPlayer from './ExpoVideoPlayer';
import LibVlcPlayer from './LibVlcPlayer';
import NativeVideoPlayer from './NativeVideoPlayer';

interface PlayerAdapterViewProps extends PlayerAdapterProps {
  engine: PlayerEngine;
  bufferConfig?: BufferConfig;
}

/**
 * Keeps one stable React boundary around playback. Source tokens are forwarded
 * as data and are deliberately never used as React keys.
 */
const PlayerAdapterView = forwardRef<PlayerAdapter, PlayerAdapterViewProps>(
  ({ engine, bufferConfig, ...props }, ref) => {
    switch (engine) {
      case 'vlc':
        return <LibVlcPlayer ref={ref} {...props} />;
      case 'expo-video':
        return <ExpoVideoPlayer ref={ref} {...props} />;
      case 'native':
        return (
          <NativeVideoPlayer
            ref={ref}
            bufferConfig={bufferConfig}
            {...props}
          />
        );
    }
  },
);

PlayerAdapterView.displayName = 'PlayerAdapterView';

export default React.memo(PlayerAdapterView);
