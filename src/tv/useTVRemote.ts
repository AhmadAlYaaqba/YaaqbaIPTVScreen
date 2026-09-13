// src/tv/useTVRemote.ts
import { useEffect, useRef } from 'react';
import { Platform, TVEventHandler } from 'react-native';

import { toRemoteAction, type TVRemoteAction } from './remoteActions';

/**
 * Calls `onAction` for each remote key press (key-down; held keys repeat).
 * No-op on non-TV devices. The subscription is created once per `enabled`
 * change — the latest `onAction` is read through a ref, so inline callbacks
 * don't resubscribe on every render.
 *
 * Back is not delivered here; use useBackHandler.
 */
export function useTVRemote(
  onAction: (action: TVRemoteAction) => void,
  enabled: boolean = true,
): void {
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    if (!Platform.isTV || !enabled) {
      return;
    }
    const subscription = TVEventHandler.addListener(event => {
      const action = toRemoteAction(event);
      if (action) {
        onActionRef.current(action);
      }
    });
    return () => subscription?.remove();
  }, [enabled]);
}
