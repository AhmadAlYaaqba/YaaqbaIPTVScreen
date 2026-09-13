// src/tv/deviceProfile.ts
// Single source of truth for form-factor decisions. Platform.isTV is resolved
// at runtime (Android UiModeManager == TELEVISION), so one APK/AAB serves both
// phones and TVs — never branch on manufacturer or model names.

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export type FormFactor = 'handheld' | 'tv';
export type InputMode = 'touch' | 'remote';

export interface DeviceProfile {
  formFactor: FormFactor;
  inputMode: InputMode;
  /** Android low-RAM flag or < 3 GB total — e.g. Chromecast with Google TV (2 GB). */
  isLowMemory: boolean;
}

const LOW_MEMORY_BYTES = 3 * 1024 * 1024 * 1024;

export const isTV: boolean = Platform.isTV;

let cachedProfile: DeviceProfile | undefined;

export function getDeviceProfile(): DeviceProfile {
  if (!cachedProfile) {
    let isLowMemory = false;
    try {
      isLowMemory =
        DeviceInfo.isLowRamDevice() ||
        DeviceInfo.getTotalMemorySync() < LOW_MEMORY_BYTES;
    } catch {
      // Native module unavailable (tests); assume a capable device.
    }
    cachedProfile = {
      formFactor: isTV ? 'tv' : 'handheld',
      inputMode: isTV ? 'remote' : 'touch',
      isLowMemory,
    };
  }
  return cachedProfile;
}
