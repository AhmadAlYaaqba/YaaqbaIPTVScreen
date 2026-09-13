// src/tv/remoteActions.ts
// Maps raw react-native-tvos hardware key events to app-level remote actions.
//
// Notes from the fork's Android key map (ReactAndroidHWInputDeviceHelper.kt):
// - Every key press is dispatched twice: ACTION_DOWN (eventKeyAction 0,
//   repeated while held) and ACTION_UP (1). We act on DOWN only, so a press
//   fires once and holding left/right auto-repeats (useful for seeking).
// - The Back key is NOT part of this stream; it arrives via BackHandler.
// - There is no long-select event.

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

const KEY_ACTION_DOWN = 0;
const KEY_ACTION_UP = 1;

export interface RawTVKeyEvent {
  eventType: string;
  eventKeyAction?: number;
}

/**
 * Returns the remote action for a key-down (or unknown-phase) event, or null
 * for key-up events, focus/blur/pan events and unmapped keys.
 */
export function toRemoteAction(event: RawTVKeyEvent): TVRemoteAction | null {
  if (event.eventKeyAction === KEY_ACTION_UP) {
    return null;
  }
  if (
    event.eventKeyAction !== undefined &&
    event.eventKeyAction !== KEY_ACTION_DOWN &&
    event.eventKeyAction !== -1
  ) {
    return null;
  }
  return ACTIONS.has(event.eventType)
    ? (event.eventType as TVRemoteAction)
    : null;
}
