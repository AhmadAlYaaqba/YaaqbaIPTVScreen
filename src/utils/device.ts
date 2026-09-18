import { Platform, type PlatformIOSStatic } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/**
 * Tablet: an iPad, or an Android tablet. Tablets are free to rotate (phones
 * stay portrait-locked outside the player) and get a denser catalog grid.
 * TVs are never tablets, even though some report a tablet form factor.
 */
export const IS_TABLET: boolean = Platform.isTV
  ? false
  : Platform.OS === 'ios'
  ? (Platform as PlatformIOSStatic).isPad
  : Platform.OS === 'android' && DeviceInfo.isTablet();
