export type CachedImageVariant =
  | 'poster'
  | 'backdrop'
  | 'cast'
  | 'channel-logo'
  | 'continue-watching'
  | 'episode-still';

interface ImageCacheIdentity {
  playlistId?: string | null;
  contentId: string | number;
  variant: CachedImageVariant;
}

function hashText(value: string, seed: number): number {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 4_294_967_291;
  }
  return Math.floor(hash);
}

/**
 * Returns a deterministic, opaque key. URLs and playlist credentials must never
 * be used as cache identifiers because native image caches can outlive a session.
 */
export function buildCachedImageKey({
  playlistId,
  contentId,
  variant,
}: ImageCacheIdentity): string {
  const identity = JSON.stringify([
    'v1',
    playlistId || 'no-playlist',
    variant,
    String(contentId),
  ]);
  const first = hashText(identity, 0x811c9dc5).toString(36);
  const second = hashText(identity, 0x9e3779b9).toString(36);
  return `yi-v1-${first}-${second}`;
}

export function buildImageSourceToken(cacheKey: string, uri: string): string {
  return `${cacheKey}-${hashText(uri, 0x85ebca6b).toString(36)}`;
}
