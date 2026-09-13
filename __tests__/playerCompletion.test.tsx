/* eslint-env jest */

import React, { useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { useVideoPlayer } from '../src/hooks/useVideoPlayer';
import type { PlaybackRequest } from '../src/types/player';
import { isVlcNaturalCompletion } from '../src/utils/playerCompletion';

const connection = {
  domain: 'example.com',
  port: '80',
  username: 'user',
  password: 'pass',
};

const movieRequest: PlaybackRequest = {
  kind: 'movie',
  streamId: 'movie-1',
  extension: 'mp4',
  title: 'Movie',
  expectedDuration: 100,
};

describe('player completion', () => {
  it('accepts only a near-end, non-manual VLC stop for VOD', () => {
    expect(
      isVlcNaturalCompletion({
        isLive: false,
        wasManuallyStopped: false,
        durationMs: 100_000,
        positionMs: 98_500,
      }),
    ).toBe(true);
    expect(
      isVlcNaturalCompletion({
        isLive: false,
        wasManuallyStopped: true,
        durationMs: 100_000,
        positionMs: 100_000,
      }),
    ).toBe(false);
    expect(
      isVlcNaturalCompletion({
        isLive: false,
        wasManuallyStopped: false,
        durationMs: 100_000,
        positionMs: 90_000,
      }),
    ).toBe(false);
    expect(
      isVlcNaturalCompletion({
        isLive: true,
        wasManuallyStopped: false,
        durationMs: 100_000,
        positionMs: 100_000,
      }),
    ).toBe(false);
  });

  it('does not complete from near-end progress and handles an end once', async () => {
    const completionEffect = jest.fn();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    let latestPlayer: ReturnType<typeof useVideoPlayer> | null = null;

    function Harness() {
      const player = useVideoPlayer({
        request: movieRequest,
        connection,
        playlistId: 'playlist-1',
        playerEngine: 'native',
        isOffline: false,
        useProxy: false,
      });
      latestPlayer = player;
      useEffect(() => {
        if (player.isCompleted) {
          completionEffect();
        }
      }, [player.isCompleted]);
      return null;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness />);
    });

    ReactTestRenderer.act(() => {
      latestPlayer!.onProgress({
        currentTime: 99,
        seekableDuration: 100,
      });
    });
    expect(latestPlayer!.isCompleted).toBe(false);

    ReactTestRenderer.act(() => {
      latestPlayer!.onEnd();
    });
    expect(latestPlayer!.isCompleted).toBe(true);
    expect(latestPlayer!.currentProgressRef.current).toBe(100);

    ReactTestRenderer.act(() => {
      latestPlayer!.onEnd();
    });
    expect(completionEffect).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => renderer!.unmount());
    infoSpy.mockRestore();
  });
});
