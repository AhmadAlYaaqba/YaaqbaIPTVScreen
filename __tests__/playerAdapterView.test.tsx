/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import type { PlaybackSource, PlayerEngine } from '../src/types/player';

const mockCounters = {
  native: { mounts: 0, unmounts: 0 },
  expo: { mounts: 0, unmounts: 0 },
  vlc: { mounts: 0, unmounts: 0 },
};

jest.mock('../src/components/NativeVideoPlayer', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(function MockNativePlayer(_props: unknown, _ref: unknown) {
      ReactModule.useEffect(() => {
        mockCounters.native.mounts += 1;
        return () => {
          mockCounters.native.unmounts += 1;
        };
      }, []);
      return ReactModule.createElement(ReactNative.View, {
        testID: 'native-player',
      });
    }),
  };
});

jest.mock('../src/components/ExpoVideoPlayer', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(function MockExpoPlayer(_props: unknown, _ref: unknown) {
      ReactModule.useEffect(() => {
        mockCounters.expo.mounts += 1;
        return () => {
          mockCounters.expo.unmounts += 1;
        };
      }, []);
      return ReactModule.createElement(ReactNative.View, {
        testID: 'expo-player',
      });
    }),
  };
});

jest.mock('../src/components/LibVlcPlayer', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(function MockVlcPlayer(_props: unknown, _ref: unknown) {
      ReactModule.useEffect(() => {
        mockCounters.vlc.mounts += 1;
        return () => {
          mockCounters.vlc.unmounts += 1;
        };
      }, []);
      return ReactModule.createElement(ReactNative.View, {
        testID: 'vlc-player',
      });
    }),
  };
});

const PlayerAdapterView = require('../src/components/PlayerAdapterView').default;

const firstSource: PlaybackSource = {
  id: 'direct:m3u8',
  uri: 'https://example.com/first.m3u8',
  type: 'm3u8',
  label: 'HLS (direct)',
  extension: 'm3u8',
  delivery: 'direct',
};

const secondSource: PlaybackSource = {
  ...firstSource,
  uri: 'https://example.com/second.m3u8',
};

function renderAdapter(
  engine: PlayerEngine,
  source: PlaybackSource,
  sourceToken: string,
) {
  return (
    <PlayerAdapterView
      engine={engine}
      source={source}
      sourceToken={sourceToken}
      isLive
      isPaused={false}
      resumePosition={0}
      onLoad={jest.fn()}
      onError={jest.fn()}
      onProgress={jest.fn()}
      onBuffer={jest.fn()}
    />
  );
}

describe('PlayerAdapterView lifecycle', () => {
  beforeEach(() => {
    Object.values(mockCounters).forEach(counter => {
      counter.mounts = 0;
      counter.unmounts = 0;
    });
  });

  it('does not remount an engine when a channel or retry token changes', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        renderAdapter('native', firstSource, 'channel-1:0'),
      );
    });
    await ReactTestRenderer.act(async () => {
      renderer!.update(renderAdapter('native', secondSource, 'channel-2:1'));
    });

    expect(mockCounters.native).toEqual({ mounts: 1, unmounts: 0 });

    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('mounts a different adapter only when the selected engine changes', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        renderAdapter('native', firstSource, 'channel-1:0'),
      );
    });
    await ReactTestRenderer.act(async () => {
      renderer!.update(
        renderAdapter('expo-video', secondSource, 'channel-2:1'),
      );
    });

    expect(mockCounters.native).toEqual({ mounts: 1, unmounts: 1 });
    expect(mockCounters.expo).toEqual({ mounts: 1, unmounts: 0 });

    ReactTestRenderer.act(() => renderer!.unmount());
  });
});
