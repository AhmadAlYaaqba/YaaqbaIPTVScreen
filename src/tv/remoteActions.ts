// src/tv/remoteActions.ts
// Maps raw react-native-tvos hardware key events to app-level remote actions.
//
// Observed on the Google TV emulator (API 34, new architecture): only
// ACTION_UP (eventKeyAction 1) reaches JS for D-pad, Select and media keys —
// key-down is consumed natively (focus navigation) before the JS dispatch.
// So we act on key-up, which fires exactly once per press. Holding a key does
// not auto-repeat. Events with no phase (-1 / undefined) are accepted too.
//
// The Back key is NOT part of this stream; it arrives via BackHandler.
// There is no long-select event.

export type TVRemoteAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'playPause'
  | 'rewind'
  | 'fastForward'
  | 'stop'
  | 'next'
  | 'previous'
  | 'info'
  | 'menu'
  | 'channelUp'
  | 'channelDown';

const ACTIONS: ReadonlySet<string> = new Set<TVRemoteAction>([
  'up',
  'down',
  'left',
  'right',
  'select',
  'playPause',
  'rewind',
  'fastForward',
  'stop',
  'next',
  'previous',
  'info',
  'menu',
  'channelUp',
  'channelDown',
]);

const KEY_ACTION_UP = 1;
const KEY_ACTION_UNKNOWN = -1;

export interface RawTVKeyEvent {
  eventType: string;
  eventKeyAction?: number;
}

/**
 * Returns the remote action for a key-up (or unknown-phase) event, or null for
 * key-down events, focus/blur/pan events and unmapped keys.
 */
export function toRemoteAction(event: RawTVKeyEvent): TVRemoteAction | null {
  const phase = event.eventKeyAction;
  if (
    phase !== undefined &&
    phase !== KEY_ACTION_UP &&
    phase !== KEY_ACTION_UNKNOWN
  ) {
    return null;
  }
  return ACTIONS.has(event.eventType)
    ? (event.eventType as TVRemoteAction)
    : null;
}
