import {
  buildPlaybackSources,
  decidePlaybackFailure,
  getPlaybackResumePosition,
  switchLivePlaybackRequest,
} from '../src/utils/playbackSources';
import type { PlaybackRequest } from '../src/types/player';

const connection = {
  domain: 'http://example.com',
  port: '8080',
  username: 'user',
  password: 'pass',
};

describe('playback source generation', () => {
  it('builds proxied requested/alternate sources before direct live sources', () => {
    const request: PlaybackRequest = {
      kind: 'live',
      streamId: '42',
      extension: 'm3u8',
      title: 'News',
      channelName: 'News',
    };

    const sources = buildPlaybackSources(request, connection, true);

    expect(sources.map(source => source.id)).toEqual([
      'proxy:m3u8',
      'proxy:ts',
      'direct:m3u8',
      'direct:ts',
    ]);
    expect(sources[0].uri).toContain('/api/stream?url=');
    expect(sources[2].uri).toBe(
      'http://example.com:8080/live/user/pass/42.m3u8',
    );
  });

  it('never adds proxied sources when the proxy preference is disabled', () => {
    const request: PlaybackRequest = {
      kind: 'episode',
      streamId: '99',
      extension: '.mkv',
      title: 'Episode 1',
      seriesId: 'series-1',
    };

    const sources = buildPlaybackSources(request, connection, false);

    expect(sources.map(source => source.id)).toEqual([
      'direct:mkv',
      'direct:mp4',
    ]);
    expect(sources[0].uri).toBe(
      'http://example.com:8080/series/user/pass/99.mkv',
    );
  });
});

describe('playback fallback decisions', () => {
  it('retries after one and two seconds before advancing', () => {
    expect(
      decidePlaybackFailure({
        sourceIndex: 0,
        sourceCount: 2,
        retriesUsed: 0,
        isOffline: false,
      }),
    ).toEqual({ kind: 'retry', attempt: 1, delayMs: 1000 });
    expect(
      decidePlaybackFailure({
        sourceIndex: 0,
        sourceCount: 2,
        retriesUsed: 1,
        isOffline: false,
      }),
    ).toEqual({ kind: 'retry', attempt: 2, delayMs: 2000 });
    expect(
      decidePlaybackFailure({
        sourceIndex: 0,
        sourceCount: 2,
        retriesUsed: 2,
        isOffline: false,
      }),
    ).toEqual({ kind: 'next-source', sourceIndex: 1 });
  });

  it('pauses the fallback cycle offline and exhausts only the last source', () => {
    expect(
      decidePlaybackFailure({
        sourceIndex: 1,
        sourceCount: 2,
        retriesUsed: 2,
        isOffline: true,
      }),
    ).toEqual({ kind: 'wait-for-network' });
    expect(
      decidePlaybackFailure({
        sourceIndex: 1,
        sourceCount: 2,
        retriesUsed: 2,
        isOffline: false,
      }),
    ).toEqual({ kind: 'exhausted' });
  });

  it('retains the furthest VOD position across reconnects', () => {
    expect(getPlaybackResumePosition(120, 95)).toBe(120);
    expect(getPlaybackResumePosition(120, 145)).toBe(145);
  });

  it('switches live channel identity while preserving the category', () => {
    const current: PlaybackRequest = {
      kind: 'live',
      streamId: '10',
      extension: 'm3u8',
      title: 'Old channel',
      channelName: 'Old channel',
      categoryId: 'news',
    };

    const next = switchLivePlaybackRequest(current, {
      streamId: '11',
      channelName: 'New channel',
      extension: '.ts',
      thumbnail: 'icon.png',
    });

    expect(next).toEqual({
      kind: 'live',
      streamId: '11',
      extension: 'ts',
      title: 'New channel',
      channelName: 'New channel',
      thumbnail: 'icon.png',
      categoryId: 'news',
    });
  });
});
