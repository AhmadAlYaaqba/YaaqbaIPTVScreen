// src/types/player.ts
// Player engine selection shared by Redux state, Keychain persistence and the
// player screen. Extensible: add new engines (e.g. 'mpv') to PLAYER_ENGINES.

export const PLAYER_ENGINES = ['vlc', 'native', 'expo-video'] as const;

export type PlayerEngine = (typeof PLAYER_ENGINES)[number];

export const DEFAULT_PLAYER_ENGINE: PlayerEngine = 'vlc';

export function isPlayerEngine(value: unknown): value is PlayerEngine {
  return (
    typeof value === 'string' &&
    (PLAYER_ENGINES as readonly string[]).includes(value)
  );
}

// Minimal imperative surface every engine wrapper exposes through its ref.
// seek() is required; the rest are optional because the native player manages
// its own lifecycle (stop via isPaused/playInBackground) while VLC needs
// explicit commands.
export interface PlayerHandle {
  seek: (timeSeconds: number) => void;
  play?: () => void;
  pause?: () => void;
  stop?: () => void;
}

export const PLAYER_ENGINE_LABELS: Record<PlayerEngine, string> = {
  vlc: 'VLC',
  native: 'Standard',
  'expo-video': 'Expo Video',
};
