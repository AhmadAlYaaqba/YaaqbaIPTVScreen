import type {
  LivePlaybackRequest,
  PlaybackRequest,
  PlaybackSource,
} from '../types/player';
import { proxyStreamUrl } from './proxy';
import {
  buildLiveStreamUrl,
  buildMovieStreamUrl,
  buildSeriesStreamUrl,
} from './xtream';

export interface PlaybackConnection {
  domain: string;
  port: string;
  username: string;
  password: string;
}

export interface LiveChannelSelection {
  streamId: string;
  channelName: string;
  extension: string;
  thumbnail?: string;
}

export const PLAYBACK_RETRY_DELAYS_MS = [1000, 2000] as const;

export type PlaybackFailureDecision =
  | { kind: 'wait-for-network' }
  | { kind: 'retry'; attempt: number; delayMs: number }
  | { kind: 'next-source'; sourceIndex: number }
  | { kind: 'exhausted' };

function normalizeExtension(extension: string, fallback: string): string {
  return extension.trim().replace(/^\./, '').toLowerCase() || fallback;
}

function getRequestedAndAlternateExtensions(
  request: PlaybackRequest,
): string[] {
  const fallback = request.kind === 'live' ? 'm3u8' : 'mp4';
  const requested = normalizeExtension(request.extension, fallback);

  let alternate: string;
  if (request.kind === 'live') {
    alternate = requested === 'ts' ? 'm3u8' : 'ts';
  } else if (requested === 'm3u8' || requested === 'ts') {
    alternate = requested === 'ts' ? 'm3u8' : 'ts';
  } else {
    alternate = requested === 'mkv' ? 'mp4' : 'mkv';
  }

  return requested === alternate ? [requested] : [requested, alternate];
}

function getReactNativeVideoType(extension: string): string | undefined {
  switch (extension) {
    case 'm3u8':
      return 'm3u8';
    case 'ts':
      return 'mpegts';
    case 'mpd':
      return 'mpd';
    case 'mp4':
      return 'mp4';
    default:
      return undefined;
  }
}

export function buildDirectPlaybackUrl(
  request: PlaybackRequest,
  connection: PlaybackConnection,
  extension = request.extension,
): string {
  const streamArgs = {
    domain: connection.domain,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    streamId: request.streamId,
    extension,
  };

  switch (request.kind) {
    case 'live':
      return buildLiveStreamUrl(streamArgs);
    case 'movie':
      return buildMovieStreamUrl(streamArgs);
    case 'episode':
      return buildSeriesStreamUrl(streamArgs);
  }
}

export function buildPlaybackSources(
  request: PlaybackRequest,
  connection: PlaybackConnection,
  useProxy: boolean,
): PlaybackSource[] {
  const extensions = getRequestedAndAlternateExtensions(request);
  const deliveries: PlaybackSource['delivery'][] = useProxy
    ? ['proxy', 'direct']
    : ['direct'];

  return deliveries.flatMap(delivery =>
    extensions.map(extension => {
      const directUri = buildDirectPlaybackUrl(request, connection, extension);
      const isProxy = delivery === 'proxy';

      return {
        id: `${delivery}:${extension}`,
        uri: proxyStreamUrl(directUri, isProxy),
        type: getReactNativeVideoType(extension),
        label: `${extension.toUpperCase()} (${delivery})`,
        extension,
        delivery,
      };
    }),
  );
}

export function decidePlaybackFailure({
  sourceIndex,
  sourceCount,
  retriesUsed,
  isOffline,
}: {
  sourceIndex: number;
  sourceCount: number;
  retriesUsed: number;
  isOffline: boolean;
}): PlaybackFailureDecision {
  if (isOffline) {
    return { kind: 'wait-for-network' };
  }

  if (retriesUsed < PLAYBACK_RETRY_DELAYS_MS.length) {
    const attempt = retriesUsed + 1;
    return {
      kind: 'retry',
      attempt,
      delayMs: PLAYBACK_RETRY_DELAYS_MS[retriesUsed],
    };
  }

  if (sourceIndex + 1 < sourceCount) {
    return { kind: 'next-source', sourceIndex: sourceIndex + 1 };
  }

  return { kind: 'exhausted' };
}

export function getPlaybackResumePosition(
  initialProgress: number,
  currentProgress: number,
): number {
  return Math.max(0, initialProgress, currentProgress);
}

export function switchLivePlaybackRequest(
  current: LivePlaybackRequest,
  selection: LiveChannelSelection,
): LivePlaybackRequest {
  return {
    kind: 'live',
    streamId: selection.streamId,
    extension: normalizeExtension(selection.extension, 'm3u8'),
    title: selection.channelName,
    channelName: selection.channelName,
    thumbnail: selection.thumbnail,
    categoryId: current.categoryId,
  };
}
