// src/tv/TVTouchable.tsx
// Drop-in replacement for TouchableOpacity in shared screens.
//
// - Phones: renders the original TouchableOpacity with the exact same props, so
//   touch feedback and layout are unchanged.
// - TV: renders FocusablePressable, which adds a visible focus ring + scale.
//   TouchableOpacity's only Android TV focus cue is a faint opacity change that
//   is unreadable from a couch.

import React from 'react';
import {
  Platform,
  TouchableOpacity,
  type StyleProp,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';

import FocusablePressable from './FocusablePressable';

export interface TVTouchableProps extends TouchableOpacityProps {
  /** Extra style while focused (TV only). */
  focusedStyle?: StyleProp<ViewStyle>;
  /** Scale while focused (TV only). Defaults to FocusablePressable's. */
  focusScale?: number;
}

function TVTouchable({
  focusedStyle,
  focusScale,
  activeOpacity: _activeOpacity,
  style,
  children,
  ...rest
}: TVTouchableProps) {
  if (!Platform.isTV) {
    return (
      <TouchableOpacity activeOpacity={_activeOpacity} style={style} {...rest}>
        {children}
      </TouchableOpacity>
    );
  }
  return (
    <FocusablePressable
      {...rest}
      style={style as StyleProp<ViewStyle>}
      focusedStyle={focusedStyle}
      focusScale={focusScale}>
      {children}
    </FocusablePressable>
  );
}

export default TVTouchable;
