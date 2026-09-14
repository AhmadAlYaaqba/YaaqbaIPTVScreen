import React from 'react';
import FontAwesome5, {
  type FontAwesome5IconProps,
} from 'react-native-vector-icons/FontAwesome5';

/**
 * The complete set of icons used by the active phone and TV interfaces.
 * Keeping this list explicit makes misspelled or non-solid glyphs a type error.
 */
export const APP_ICON_NAMES = [
  'arrow-left',
  'backward',
  'bolt',
  'broadcast-tower',
  'check',
  'check-circle',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'circle',
  'cog',
  'exclamation-circle',
  'exclamation-triangle',
  'expand-arrows-alt',
  'eye',
  'eye-slash',
  'film',
  'forward',
  'home',
  'history',
  'inbox',
  'key',
  'layer-group',
  'list',
  'lock',
  'mobile-alt',
  'moon',
  'pause',
  'play',
  'play-circle',
  'plus',
  'redo',
  'satellite-dish',
  'search',
  'server',
  'shield-alt',
  'sign-out-alt',
  'sliders-h',
  'star',
  'sun',
  'times',
  'trash-alt',
  'tv',
  'user',
  'wifi',
] as const;

export type AppIconName = (typeof APP_ICON_NAMES)[number];

export interface AppIconProps
  extends Omit<
    FontAwesome5IconProps,
    'name' | 'brand' | 'light' | 'regular' | 'solid'
  > {
  name: AppIconName;
}

/** The only icon entry point for active UI. */
export default function AppIcon(props: AppIconProps) {
  return <FontAwesome5 {...props} solid />;
}
