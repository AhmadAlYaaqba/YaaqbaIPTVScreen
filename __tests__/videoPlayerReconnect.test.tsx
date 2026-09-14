/* eslint-env jest */

import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {
  BUFFERING_ACTIVITY_GRACE_MS,
  BUFFERING_INDICATOR_DELAY_MS,
  LIVE_ERROR_RECOVERY_GRACE_MS,
  LIVE_STALL_TIMEOUT_MS,
  useVideoPlayer,
} from '../src/hooks/useVideoPlayer';
import type { PlaybackRequest } from '../src/types/player';

const request: PlaybackRequest = {
  kind: 'live',
  streamId: '42',
  extension: 'm3u8',
  title: 'Live News',
  channelName: 'Live News',
};

const connection = {
  domain: 'http://example.com',
  port: '8080',
  username: 'user',
  password: 'pass',
};

describe('live playback recovery', () => {
  let latest: ReturnType<typeof useVideoPlayer> | null;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  let appStateHandler: ((state: AppStateStatus) => void) | undefined;
  let consoleInfoSpy: jest.SpyInstance;
  let appStateSpy: jest.SpyInstance;

  const getLatest = () => {
    if (!latest) {
      throw new Error('Video player state was not rendered');
    }
    return latest;
  };

  const Harness = ({ isOffline = false }: { isOffline?: boolean }) => {
    latest = useVideoPlayer({
      request,
      connection,
      playlistId: 'playlist-a',
      playerEngine: 'expo-video',
      isOffline,
      useProxy: false,
      autoReconnect: true,
    });
    return null;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    latest = null;
    appStateHandler = undefined;
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    appStateSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      });
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
  });

  afterEach(() => {
    ReactTestRenderer.act(() => renderer.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
    consoleInfoSpy.mockRestore();
    appStateSpy.mockRestore();
  });

  it('clears a stale buffering signal while live timestamps keep advancing', () => {
    const initialToken = getLatest().sourceToken;
    ReactTestRenderer.act(() => {
      getLatest().onLoad({ duration: 0 });
      getLatest().onProgress({ currentTime: 1, seekableDuration: 0 });
      getLatest().onBuffer({ isBuffering: true });
      jest.advanceTimersByTime(BUFFERING_INDICATOR_DELAY_MS);
    });
    expect(getLatest().isBuffering).toBe(false);

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1000 - BUFFERING_INDICATOR_DELAY_MS);
      getLatest().onProgress({ currentTime: 2, seekableDuration: 0 });
    });
    expect(getLatest().isBuffering).toBe(false);

    for (let time = 3; time <= 25; time += 1) {
      ReactTestRenderer.act(() => {
        jest.advanceTimersByTime(1000);
        getLatest().onProgress({ currentTime: time, seekableDuration: 0 });
      });
      expect(getLatest().isBuffering).toBe(false);
      expect(getLatest().isReconnecting).toBe(false);
    }

    expect(getLatest().sourceToken).toBe(initialToken);
    expect(getLatest().error).toBeNull();
  });

  it('cancels a recoverable live error when playback continues', () => {
    const initialToken = getLatest().sourceToken;
    ReactTestRenderer.act(() => {
      getLatest().onLoad({ duration: 0 });
      getLatest().onProgress({ currentTime: 10, seekableDuration: 0 });
      getLatest().onError(new Error('temporary transport error'));
    });

    expect(getLatest().isReconnecting).toBe(false);
    expect(getLatest().error).toBeNull();

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1000);
      getLatest().onProgress({ currentTime: 11, seekableDuration: 0 });
      jest.advanceTimersByTime(LIVE_ERROR_RECOVERY_GRACE_MS + 2000);
    });

    expect(getLatest().sourceToken).toBe(initialToken);
    expect(getLatest().isReconnecting).toBe(false);
    expect(getLatest().error).toBeNull();
  });

  it('still retries a genuine live stall after the recovery window', () => {
    const initialToken = getLatest().sourceToken;
    ReactTestRenderer.act(() => {
      getLatest().onLoad({ duration: 0 });
      getLatest().onProgress({ currentTime: 20, seekableDuration: 0 });
      getLatest().onBuffer({ isBuffering: true });
      jest.advanceTimersByTime(BUFFERING_ACTIVITY_GRACE_MS);
    });

    expect(getLatest().isBuffering).toBe(true);

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(
        LIVE_STALL_TIMEOUT_MS - BUFFERING_ACTIVITY_GRACE_MS,
      );
    });

    expect(getLatest().isReconnecting).toBe(true);
    expect(getLatest().reconnectAttempt).toBe(1);

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getLatest().sourceToken).not.toBe(initialToken);
  });

  it('cancels a pending retry when the player reports recovery', () => {
    const initialToken = getLatest().sourceToken;
    ReactTestRenderer.act(() => {
      getLatest().onError(new Error('startup error'));
    });
    expect(getLatest().isReconnecting).toBe(true);

    ReactTestRenderer.act(() => {
      getLatest().onBuffer({ isBuffering: false });
      jest.advanceTimersByTime(3000);
    });

    expect(getLatest().sourceToken).toBe(initialToken);
    expect(getLatest().isReconnecting).toBe(false);
    expect(getLatest().error).toBeNull();
  });

  it('does not replace a healthy source after a routine foreground transition', () => {
    const initialToken = getLatest().sourceToken;
    ReactTestRenderer.act(() => {
      getLatest().onLoad({ duration: 0 });
      getLatest().onProgress({ currentTime: 5, seekableDuration: 0 });
      appStateHandler?.('background');
      appStateHandler?.('active');
    });

    expect(getLatest().sourceToken).toBe(initialToken);
    expect(getLatest().isReconnecting).toBe(false);
    expect(getLatest().isBuffering).toBe(false);
  });
});
