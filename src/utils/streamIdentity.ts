import { unwrapProxyUrl } from './proxy';

export interface LiveStreamIdentity {
  streamId: string;
  containerExtension: string;
}

const LIVE_STREAM_PATH = /\/live\/[^/]+\/[^/]+\/([^/.?]+)\.([a-z0-9]+)$/i;

export function extractContainerExtension(streamUrl: string): string | null {
  try {
    const pathname = new URL(unwrapProxyUrl(streamUrl)).pathname;
    return pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function extractLiveStreamIdentity(
  streamUrl: string,
): LiveStreamIdentity | null {
  try {
    const directUrl = unwrapProxyUrl(streamUrl);
    const pathname = new URL(directUrl).pathname;
    const match = pathname.match(LIVE_STREAM_PATH);

    if (!match) {
      return null;
    }

    return {
      streamId: decodeURIComponent(match[1]),
      containerExtension: match[2].toLowerCase(),
    };
  } catch {
    return null;
  }
}
