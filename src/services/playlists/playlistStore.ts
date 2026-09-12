import {
  ACCESSIBLE,
  getGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';
import {
  PlayerEngine,
  DEFAULT_PLAYER_ENGINE,
  isPlayerEngine,
} from '../../types/player';

export type PlaylistKind = 'activation' | 'xtream';

export interface Playlist {
  id: string;
  name: string;
  kind: PlaylistKind;
  username: string;
  password: string;
  serverDomain: string;
  serverPort: string;
  useProxy: boolean;
}

export interface PlaylistStoreShape {
  playlists: Playlist[];
  activeId: string | null;
  /** Selected player engine (device-wide, like useVLC before it). */
  playerEngine: PlayerEngine;
  /**
   * Legacy boolean kept in the persisted shape purely so a rollback to an
   * older build still reads a sane value. Derived from playerEngine on write.
   */
  useVLC: boolean;
}

const PLAYLIST_SERVICE = 'my-iptv-playlists';
const PLAYLIST_ACCOUNT = 'iptv-playlists';
const LEGACY_SERVICE = 'my-iptv-credentials';

const EMPTY_STORE: PlaylistStoreShape = {
  playlists: [],
  activeId: null,
  playerEngine: DEFAULT_PLAYER_ENGINE,
  useVLC: DEFAULT_PLAYER_ENGINE === 'vlc',
};

let cachedStore: PlaylistStoreShape | undefined;
let pendingRead: Promise<PlaylistStoreShape> | null = null;

export function generatePlaylistId(): string {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePlaylistStore(raw: any): PlaylistStoreShape {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_STORE };
  }
  const playlists: Playlist[] = Array.isArray(raw.playlists)
    ? raw.playlists.filter((p: any) => p && typeof p.id === 'string')
    : [];
  const activeId =
    typeof raw.activeId === 'string' &&
    playlists.some(p => p.id === raw.activeId)
      ? raw.activeId
      : null;
  // Migration: stores written before the multi-engine update only carry the
  // useVLC boolean — map true → 'vlc' (its successor engine), false → 'native'.
  const playerEngine: PlayerEngine = isPlayerEngine(raw.playerEngine)
    ? raw.playerEngine
    : typeof raw.useVLC === 'boolean'
      ? raw.useVLC
        ? 'vlc'
        : 'native'
      : DEFAULT_PLAYER_ENGINE;
  return {
    playlists,
    activeId,
    playerEngine,
    useVLC: playerEngine === 'vlc',
  };
}

async function readStore(): Promise<PlaylistStoreShape> {
  if (cachedStore !== undefined) {
    return cachedStore;
  }
  if (pendingRead) {
    return pendingRead;
  }

  pendingRead = getGenericPassword({ service: PLAYLIST_SERVICE })
    .then(creds => {
      if (!creds) {
        return { ...EMPTY_STORE };
      }
      try {
        return normalizePlaylistStore(JSON.parse(creds.password));
      } catch {
        return { ...EMPTY_STORE };
      }
    })
    .catch(error => {
      if (__DEV__) console.error('Error loading playlists:', error);
      return { ...EMPTY_STORE };
    })
    .finally(() => {
      pendingRead = null;
    });

  cachedStore = await pendingRead;
  return cachedStore;
}

async function writeStore(next: PlaylistStoreShape): Promise<PlaylistStoreShape> {
  cachedStore = next;
  try {
    await setGenericPassword(PLAYLIST_ACCOUNT, JSON.stringify(next), {
      service: PLAYLIST_SERVICE,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    if (__DEV__) console.error('Error saving playlists:', error);
  }
  return next;
}

export async function getPlaylistStore(): Promise<PlaylistStoreShape> {
  return readStore();
}

export async function getPlaylists(): Promise<Playlist[]> {
  return (await readStore()).playlists;
}

export async function getActivePlaylist(): Promise<Playlist | null> {
  const store = await readStore();
  if (!store.activeId) {
    return null;
  }
  return store.playlists.find(p => p.id === store.activeId) ?? null;
}

/**
 * Add a new playlist or update an existing one in place. Dedupes by id when
 * provided, otherwise by kind + credentials + server, so re-activating a code
 * or re-adding the same server never spawns a duplicate. Returns the stored
 * playlist (with its resolved id).
 */
export async function addOrUpdatePlaylist(
  input: Omit<Playlist, 'id'> & { id?: string },
): Promise<Playlist> {
  const store = await readStore();

  const matchIndex = store.playlists.findIndex(p =>
    input.id
      ? p.id === input.id
      : p.kind === input.kind &&
        p.username === input.username &&
        p.password === input.password &&
        p.serverDomain === input.serverDomain &&
        p.serverPort === input.serverPort,
  );

  let saved: Playlist;
  const playlists = [...store.playlists];

  if (matchIndex !== -1) {
    saved = { ...playlists[matchIndex], ...input, id: playlists[matchIndex].id };
    playlists[matchIndex] = saved;
  } else {
    saved = { ...input, id: input.id ?? generatePlaylistId() };
    playlists.push(saved);
  }

  await writeStore({ ...store, playlists });
  return saved;
}

export async function setActivePlaylist(id: string): Promise<Playlist | null> {
  const store = await readStore();
  const target = store.playlists.find(p => p.id === id);
  if (!target) {
    return null;
  }
  await writeStore({ ...store, activeId: id });
  return target;
}

export async function removePlaylist(id: string): Promise<PlaylistStoreShape> {
  const store = await readStore();
  const playlists = store.playlists.filter(p => p.id !== id);
  const activeId = store.activeId === id ? null : store.activeId;
  return writeStore({ ...store, playlists, activeId });
}

/** Logout: clear the active session but keep the saved playlists. */
export async function clearActivePlaylist(): Promise<PlaylistStoreShape> {
  const store = await readStore();
  return writeStore({ ...store, activeId: null });
}

export async function setGlobalPlayerEngine(
  playerEngine: PlayerEngine,
): Promise<void> {
  const store = await readStore();
  await writeStore({ ...store, playerEngine, useVLC: playerEngine === 'vlc' });
}

/** Persist a per-playlist preference change (e.g. useProxy) for the active playlist. */
export async function updateActivePlaylist(
  changes: Partial<Omit<Playlist, 'id'>>,
): Promise<Playlist | null> {
  const store = await readStore();
  if (!store.activeId) {
    return null;
  }
  const index = store.playlists.findIndex(p => p.id === store.activeId);
  if (index === -1) {
    return null;
  }
  const playlists = [...store.playlists];
  playlists[index] = { ...playlists[index], ...changes, id: playlists[index].id };
  await writeStore({ ...store, playlists });
  return playlists[index];
}

/**
 * One-time migration: if no playlists exist yet but the legacy single-blob
 * credentials are present, convert them into a first playlist and make it
 * active. Returns the migrated (now active) playlist, or null if nothing to do.
 */
export async function migrateLegacyCredentials(): Promise<Playlist | null> {
  const store = await readStore();
  if (store.playlists.length > 0) {
    return null;
  }

  try {
    const legacy = await getGenericPassword({ service: LEGACY_SERVICE });
    if (!legacy) {
      return null;
    }
    const parsed = JSON.parse(legacy.password);
    if (!parsed?.username || !parsed?.password || !parsed?.serverDomain) {
      return null;
    }

    const useProxy = parsed.useProxy ?? parsed.vlcUseProxy ?? true;
    const kind: PlaylistKind =
      parsed.serverDomain === 'screen-net.live' ? 'activation' : 'xtream';

    const playlist: Playlist = {
      id: generatePlaylistId(),
      name: parsed.username || 'My Playlist',
      kind,
      username: parsed.username,
      password: parsed.password,
      serverDomain: parsed.serverDomain,
      serverPort: parsed.serverPort ?? '',
      useProxy,
    };

    const playerEngine: PlayerEngine =
      typeof parsed.useVLC === 'boolean'
        ? parsed.useVLC
          ? 'vlc'
          : 'native'
        : store.playerEngine;
    await writeStore({
      playlists: [playlist],
      activeId: playlist.id,
      playerEngine,
      useVLC: playerEngine === 'vlc',
    });
    return playlist;
  } catch (error) {
    if (__DEV__) console.error('Legacy credential migration failed:', error);
    return null;
  }
}
