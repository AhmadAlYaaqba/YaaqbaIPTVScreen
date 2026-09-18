import { Platform, type PlatformIOSStatic } from 'react-native';

/**
 * iPad. Tablets are free to rotate (phones stay portrait-locked outside the
 * player) and get a denser catalog grid.
 */
export const IS_TABLET =
  Platform.OS === 'ios' && (Platform as PlatformIOSStatic).isPad;
