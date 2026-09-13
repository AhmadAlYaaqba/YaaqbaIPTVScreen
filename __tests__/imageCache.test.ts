import {
  buildCachedImageKey,
  buildImageSourceToken,
} from '../src/utils/imageCache';

describe('image cache identity', () => {
  it('is stable for the same playlist, content, and image variant', () => {
    const identity = {
      playlistId: 'playlist-a',
      contentId: 'movie-42',
      variant: 'poster' as const,
    };

    expect(buildCachedImageKey(identity)).toBe(buildCachedImageKey(identity));
  });

  it('isolates cache entries by playlist, content, and image variant', () => {
    const base = {
      playlistId: 'playlist-a',
      contentId: '42',
      variant: 'poster' as const,
    };
    const values = new Set([
      buildCachedImageKey(base),
      buildCachedImageKey({ ...base, playlistId: 'playlist-b' }),
      buildCachedImageKey({ ...base, contentId: '43' }),
      buildCachedImageKey({ ...base, variant: 'backdrop' }),
    ]);

    expect(values.size).toBe(4);
  });

  it('does not expose playlist IDs, content IDs, URLs, or credentials', () => {
    const key = buildCachedImageKey({
      playlistId: 'secret-playlist',
      contentId: 'movie-42',
      variant: 'poster',
    });
    const token = buildImageSourceToken(
      key,
      'https://user:password@example.com/poster.jpg',
    );

    expect(key).not.toContain('secret-playlist');
    expect(key).not.toContain('movie-42');
    expect(token).not.toContain('example.com');
    expect(token).not.toContain('password');
  });
});
