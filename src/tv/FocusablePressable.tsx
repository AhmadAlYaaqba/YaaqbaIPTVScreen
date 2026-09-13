// src/tv/FocusablePressable.tsx
// Pressable with a consistent, high-contrast focus state for remote navigation.
//
// Performance: focus is tracked in local state, so moving focus re-renders only
// the two items involved (the one losing and the one gaining focus). The ring
// border is always present (transparent when unfocused) so focusing never
// changes layout. Focus styling applies on TV only; on phones this is a plain
// Pressable.

import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
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

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={({ pressed }) => [
        IS_TV && styles.ring,
        style,
        IS_TV && focused && styles.ringFocused,
        IS_TV && focused && focusScale !== 1 && { transform: [{ scale: focusScale }] },
        IS_TV && focused && focusedStyle,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {({ pressed }) =>
        typeof children === 'function' ? children({ focused, pressed }) : children
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: radii.md,
  },
  ringFocused: {
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
