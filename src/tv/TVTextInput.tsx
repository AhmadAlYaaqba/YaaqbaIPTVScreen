// src/tv/TVTextInput.tsx
// Drop-in replacement for TextInput in shared screens.
//
// - Phones: renders the original TextInput with the exact same props.
// - TV: highlights the field while it holds D-pad focus. Android TV's only
//   native cue is a thin caret, which is invisible from across the room.
//   Border width is left unchanged so focusing never shifts layout.

import React, { forwardRef, useCallback, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';

import { colors } from '../theme/colors';

const IS_TV = Platform.isTV;

type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurEvent = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

const TVTextInput = forwardRef<TextInput, TextInputProps>(function TVTextInput(
  { style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(
    (event: FocusEvent) => {
      setFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: BlurEvent) => {
      setFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  if (!IS_TV) {
    return (
      <TextInput
        ref={ref}
        style={style}
        onFocus={onFocus}
        onBlur={onBlur}
        {...rest}
      />
    );
  }

  return (
    <TextInput
      ref={ref}
      {...rest}
      style={[style, focused && styles.focused]}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
});

const styles = StyleSheet.create({
  focused: {
    borderColor: colors.cyan,
    backgroundColor: 'rgba(34,211,238,0.10)',
  },
});

export default TVTextInput;
