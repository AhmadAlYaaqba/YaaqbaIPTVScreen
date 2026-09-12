import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { AppDispatch } from '../../store';
import { setUserCredentials } from '../../store/slices/userSlice';
import { resetIptv } from '../../store/slices/iptvSlice';
import { storage } from '../../utils/storage';
import { parseServerUrl } from '../../utils/xtream';
import {
  Playlist,
  getPlaylistStore,
  setActivePlaylist,
} from './playlistStore';
import { PlayerEngine } from '../../types/player';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = Pick<NativeStackNavigationProp<RootStackParamList>, 'reset'>;

/**
 * Hydrate the Redux user slice + watch-history namespace from a playlist and
 * make it the runtime source of truth. Does NOT navigate.
 */
export function applyPlaylistToSession(
  playlist: Playlist,
  playerEngine: PlayerEngine,
  dispatch: AppDispatch,
): Promise<void> {
  storage.setActivePlaylistId(playlist.id);

  // Heal playlists saved before serverPort parsing existed: content screens
  // only fetch when serverPort is non-empty, so derive it from the URL.
  const serverPort =
    playlist.serverPort || parseServerUrl(playlist.serverDomain).port;

  return storage.migrateLegacyPlaylistData(playlist.id).then(() => {
    dispatch(
      setUserCredentials({
        playlistId: playlist.id,
        username: playlist.username,
        password: playlist.password,
        serverDomain: playlist.serverDomain,
        serverPort,
        useProxy: playlist.useProxy,
        playerEngine,
      }),
    );
  });
}

export function usePlaylists() {
  const dispatch = useDispatch<AppDispatch>();

  /**
   * Switch to (or freshly enter) a playlist: persist active id, hydrate the
   * session, clear stale content, then reset navigation to a clean Main so no
   * previous-playlist list can be tapped against the new credentials.
   */
  const enterPlaylist = useCallback(
    async (playlist: Playlist, navigation: Nav) => {
      const store = await getPlaylistStore();
      await setActivePlaylist(playlist.id);
      await applyPlaylistToSession(playlist, store.playerEngine, dispatch);
      dispatch(resetIptv());
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    },
    [dispatch],
  );

  return { enterPlaylist };
}
