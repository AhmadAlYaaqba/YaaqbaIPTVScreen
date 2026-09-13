// src/tv/useBackHandler.ts
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Handles the hardware Back key (Android phone back button and TV remote Back)
 * while `enabled`. Return true from `handler` to consume the press.
 *
 * BackHandler runs the most recently registered listener first, so an overlay
 * that mounts above a screen gets the press before the screen/navigator —
 * which is how "Back closes the nearest overlay first" is achieved.
 */
export function useBackHandler(
  handler: () => boolean,
  enabled: boolean = true,
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => handlerRef.current(),
    );
    return () => subscription.remove();
  }, [enabled]);
}
