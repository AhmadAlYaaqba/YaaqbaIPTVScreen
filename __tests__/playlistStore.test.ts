/* eslint-env jest */

jest.mock('react-native-keychain', () => {
  const keychain = {
    ACCESSIBLE: {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    },
    getGenericPassword: jest.fn(() => Promise.resolve(false)),
    setGenericPassword: jest.fn(() => Promise.resolve(true)),
  };
  return { __esModule: true, ...keychain, default: keychain };
});

import {
  addOrUpdatePlaylist,
  clearActivePlaylist,
  getActivePlaylist,
  normalizePlaylistStore,
  setActivePlaylist,
} from '../src/services/playlists/playlistStore';

const playlist = {
  id: 'playlist-a',
  name: 'Playlist A',
  kind: 'xtream' as const,
  username: 'user',
  password: 'pass',
  serverDomain: 'http://example.com',
  serverPort: '80',
  useProxy: true,
};

describe('playlist session persistence', () => {
  it('preserves an explicit signed-out state instead of selecting the first playlist', () => {
    expect(
      normalizePlaylistStore({
        playlists: [playlist],
        activeId: null,
        playerEngine: 'native',
      }).activeId,
    ).toBeNull();

    expect(
      normalizePlaylistStore({
        playlists: [playlist],
        activeId: 'missing-playlist',
        playerEngine: 'native',
      }).activeId,
    ).toBeNull();
  });

  it('keeps logout explicit while retaining the saved playlist', async () => {
    await addOrUpdatePlaylist(playlist);
    await setActivePlaylist(playlist.id);
    expect((await getActivePlaylist())?.id).toBe(playlist.id);

    const signedOutStore = await clearActivePlaylist();

    expect(signedOutStore.activeId).toBeNull();
    expect(signedOutStore.playlists).toContainEqual(playlist);
    expect(await getActivePlaylist()).toBeNull();
  });
});
