/* eslint-env jest */

import {
  DEFAULT_VIDEO_CONTENT_MODE,
  getPlayerContentFit,
  isVideoContentMode,
} from '../src/types/player';
import { normalizePlaylistStore } from '../src/services/playlists/playlistStore';

describe('video content mode', () => {
  it('maps fit, crop, and stretch consistently for every engine', () => {
    expect(getPlayerContentFit('native', 'fit')).toBe('contain');
    expect(getPlayerContentFit('native', 'crop')).toBe('cover');
    expect(getPlayerContentFit('native', 'stretch')).toBe('stretch');
    expect(getPlayerContentFit('expo-video', 'stretch')).toBe('fill');
    expect(getPlayerContentFit('vlc', 'stretch')).toBe('fill');
  });

  it('migrates missing or invalid preferences to Fit', () => {
    expect(normalizePlaylistStore({}).videoContentMode).toBe(
      DEFAULT_VIDEO_CONTENT_MODE,
    );
    expect(
      normalizePlaylistStore({ videoContentMode: 'invalid' }).videoContentMode,
    ).toBe(DEFAULT_VIDEO_CONTENT_MODE);
    expect(isVideoContentMode('crop')).toBe(true);
    expect(isVideoContentMode('zoom')).toBe(false);
  });
});
