// src/types/player.ts
// Player engine selection shared by Redux state, Keychain persistence and the
// player screen. Extensible: add new engines (e.g. 'mpv') to PLAYER_ENGINES.

import { Platform } from 'react-native';

export const PLAYER_ENGINES = ['vlc', 'native', 'expo-video'] as const;

export type PlayerEngine = (typeof PLAYER_ENGINES)[number];

export const VIDEO_CONTENT_MODES = ['fit', 'crop', 'stretch'] as const;
export type VideoContentMode = (typeof VIDEO_CONTENT_MODES)[number];
export const DEFAULT_VIDEO_CONTENT_MODE: VideoContentMode = 'fit';

export interface PlaybackResume {
  progress: number;
  totalDuration?: number;
}

export interface PlaybackEpisode {
  id: string | number;
  title?: string;
  container_extension?: string;
  [key: string]: unknown;
}

interface PlaybackRequestBase {
  streamId: string;
  extension: string;
  title: string;
  thumbnail?: string;
  expectedDuration?: number;
}

export interface LivePlaybackRequest extends PlaybackRequestBase {
  kind: 'live';
  channelName: string;
  categoryId?: string;
}

export interface MoviePlaybackRequest extends PlaybackRequestBase {
  kind: 'movie';
  resume?: PlaybackResume;
}

export interface EpisodePlaybackRequest extends PlaybackRequestBase {
  kind: 'episode';
  seriesId: string;
  seriesName?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  episodeList?: PlaybackEpisode[];
  currentEpisodeIndex?: number;
  resume?: PlaybackResume;
}

export type PlaybackRequest =
  | LivePlaybackRequest
  | MoviePlaybackRequest
  | EpisodePlaybackRequest;

export interface PlaybackSource {
  id: string;
  uri: string;
  type?: string;
  label: string;
  extension: string;
  delivery: 'proxy' | 'direct';
}

export interface PlayerLoadEvent {
  duration: number;
}

export interface PlayerProgressEvent {
  currentTime: number;
  seekableDuration: number;
}

export interface PlayerBufferEvent {
  isBuffering: boolean;
}

export interface PlayerAdapterProps {
  source: PlaybackSource;
  sourceToken: string;
  isLive: boolean;
  isPaused: boolean;
  resumePosition: number;
  contentMode: VideoContentMode;
  onLoad: (data: PlayerLoadEvent) => void;
  onError: (error: unknown) => void;
  onProgress: (data: PlayerProgressEvent) => void;
  onBuffer: (data: PlayerBufferEvent) => void;
  onEnd: () => void;
}

// Default when the user hasn't picked an engine: VLC on iOS, Standard on Android.
export const DEFAULT_PLAYER_ENGINE: PlayerEngine = Platform.select({
  ios: 'vlc' as PlayerEngine,
  default: 'native' as PlayerEngine,
});

export function isPlayerEngine(value: unknown): value is PlayerEngine {
  return (
    typeof value === 'string' &&
    (PLAYER_ENGINES as readonly string[]).includes(value)
  );
}

export function isVideoContentMode(value: unknown): value is VideoContentMode {
  return (
    typeof value === 'string' &&
    (VIDEO_CONTENT_MODES as readonly string[]).includes(value)
  );
}

export function getPlayerContentFit(
  engine: 'native',
  mode: VideoContentMode,
): 'contain' | 'cover' | 'stretch';
export function getPlayerContentFit(
  engine: 'vlc' | 'expo-video',
  mode: VideoContentMode,
): 'contain' | 'cover' | 'fill';
export function getPlayerContentFit(
  engine: PlayerEngine,
  mode: VideoContentMode,
): 'contain' | 'cover' | 'fill' | 'stretch' {
  if (mode === 'fit') return 'contain';
  if (mode === 'crop') return 'cover';
  return engine === 'native' ? 'stretch' : 'fill';
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

export interface PlayerAdapter extends PlayerHandle {
  replaceSource: (
    source: PlaybackSource,
    resumePosition?: number,
  ) => void | Promise<void>;
}

export const PLAYER_ENGINE_LABELS: Record<PlayerEngine, string> = {
  vlc: 'VLC',
  native: 'Standard',
  'expo-video': 'Expo Video',
};
