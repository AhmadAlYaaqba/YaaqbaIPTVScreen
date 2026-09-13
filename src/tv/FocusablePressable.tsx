// src/tv/FocusablePressable.tsx
// Pressable with a consistent, high-contrast focus state for remote navigation.
//
// The focus ring is an overlay drawn above the item's content rather than a
// border on the item itself, so:
// - items that already define borderWidth/borderColor still get a full ring,
// - focusing never changes layout.
//
// Performance: focus lives in local state, so moving focus re-renders only the
// two items involved. The overlay is only mounted while focused. Focus styling
// applies on TV only; on phones this is a plain Pressable.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type PressableProps,
  type StyleProp,
  type TargetedEvent,
  type ViewStyle,
} from 'react-native';

import { colors, radii } from '../theme/colors';

export interface FocusState {
  focused: boolean;
  pressed: boolean;
}

export interface FocusablePressableProps
  extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Extra style merged in while focused (TV only). */
  focusedStyle?: StyleProp<ViewStyle>;
  /** Scale applied while focused (TV only). Set 1 to disable. */
  focusScale?: number;
  children?: React.ReactNode | ((state: FocusState) => React.ReactNode);
}

const IS_TV = Platform.isTV;
const RING_WIDTH = 3;

function FocusablePressable({
  style,
  focusedStyle,
  focusScale = 1.05,
  onFocus,
  onBlur,
  disabled,
  children,
  ...rest
}: FocusablePressableProps) {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(
    (event: NativeSyntheticEvent<TargetedEvent>) => {
      setFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: NativeSyntheticEvent<TargetedEvent>) => {
      setFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  // Match the ring's corners to the item's own radius.
  const ringStyle = useMemo(() => {
    if (!IS_TV) {
      return undefined;
    }
    const radius = StyleSheet.flatten(style)?.borderRadius;
    return [
      styles.ring,
      { borderRadius: typeof radius === 'number' ? radius : radii.md },
    ];
  }, [style]);

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={({ pressed }) => [
        style,
        IS_TV &&
          focused &&
          focusScale !== 1 && { transform: [{ scale: focusScale }] },
        IS_TV && focused && focusedStyle,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {({ pressed }) => (
        <>
          {typeof children === 'function'
            ? children({ focused, pressed })
            : children}
          {IS_TV && focused ? (
            <View pointerEvents="none" style={ringStyle} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: RING_WIDTH,
    borderColor: colors.fg,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
});

export default React.memo(FocusablePressable);
