# Yaaqba IPTV

Provider-agnostic Xtream-codes IPTV client. One codebase, three targets:

| Target | Notes |
|---|---|
| iOS (iPhone + iPad) | Portrait-locked on iPhone outside the player; iPad rotates freely and reflows the catalog grid. |
| Android phone | Same as iPhone. |
| Android TV / Google TV | Same APK/AAB as the phone. TV-only behavior is selected at runtime with `Platform.isTV` (never `.tv.tsx` files). Leanback launcher, D-pad focus, nav rail, two-pane catalogs. |

## Stack

- **Bare React Native** (not an Expo-managed app; never run `expo prebuild`). `react-native` is aliased to the `react-native-tvos` fork so Android TV focus APIs exist; the same RN core version as upstream.
- **Version pairing rule**: keep `react-native-tvos` on exactly the RN version the installed Expo SDK bundles (SDK 57 → RN 0.86.3 → `react-native-tvos@0.86.3-0`). Any other pairing needs patch-package shims for Expo. Metro packages are pinned to Expo's exact metro version via `overrides` in package.json so only one copy is installed.
- **Expo modules** are injected only for `expo-video`, `expo-image` and `expo-libvlc-player` (installed with `install-expo-modules`). `babel-preset-expo` + `expo/metro-config` are the build presets, and the dev server must be **Expo CLI** (`npm start` → `expo start`): Expo 57 emits packed source maps that only Expo's Metro server and `export:embed` can read, so `react-native start` serves bundles but fails on source maps and LogBox symbolication.
- **New Architecture + Hermes** on both platforms.
- **Data**: `@tanstack/react-query` owns all Xtream catalog data (`src/services/xtream/`), persisted to AsyncStorage by `xtreamPersistence.ts`. Redux (`src/store/`) holds only the active session (`userSlice`). Playlists/credentials live in the Keychain (`src/services/playlists/`). Watch progress, history and favorites are in `src/utils/storage.ts`.
- **TMDB** enrichment is optional; the API key is entered in Settings and stored in the Keychain. `.env` only carries `EXPO_PUBLIC_*` base URLs (inlined at build time, so never put secrets there).

## Player

Three engines behind one adapter (`src/components/PlayerAdapterView.tsx`, hook `src/hooks/useVideoPlayer.ts`), selectable in Settings:

| Engine | Library | Default on |
|---|---|---|
| `vlc` | `expo-libvlc-player` (VLCKit / libvlc) | iOS |
| `native` | `react-native-video` (ExoPlayer / AVPlayer) | Android, Android TV |
| `expo-video` | `expo-video` | opt-in |

Source selection and retry/fallback ordering is engine-agnostic (`src/utils/playbackSources.ts`): proxy → direct × requested → alternate container, two retries per source, then the next source. Live streams get a stall watchdog and error grace period; VOD gets resume, seek and auto-next-episode.

Dev-only stream overlay: set `EXPO_PUBLIC_STREAM_DEBUG=1` in `.env` to show request/failure history inside the player in debug builds.

## TV layer (`src/tv/`)

Drop-in wrappers keep phone code byte-identical: `TVTouchable`, `TVTextInput`, `FocusablePressable` (focus ring drawn as an overlay, never a layout change), `TVNavRail` (solid panel, select-to-navigate), `TVCatalogLayout` (persistent category column, select-to-change), `useTVRemote` / `remoteActions` (acts on key-up: only ACTION_UP reaches JS on Google TV), `useBackHandler`.

Hard-won rules: keep a focusable view alive at all times (remote keys are dropped otherwise); no `removeClippedSubviews` on TV lists; fixed row heights + `getItemLayout` for D-pad lists; secondary buttons must live outside the primary focusable's bounds.

## Patches (`patches/`, applied by `patch-package` on install)

- `@react-native-tvos+virtualized-lists+*.patch` — TV only. The fork wraps every list's ScrollView in an unstyled `TVFocusGuideView`, which collapses `flex: 1` lists to ~2px. The patch splits the list style into outer (guide) and inner (ScrollView) halves. **Re-derive on every fork upgrade.**
- No Expo patches are needed while the version pairing rule above holds.

## Build environment (macOS)

- Node ≥ 22.13, npm with `legacy-peer-deps=true` (already in `.npmrc`).
- Android: `JAVA_HOME` from Android Studio's bundled JBR, `ANDROID_HOME=~/Library/Android/sdk`. TV emulator: a Google TV 1080p AVD (API 34). Debug install: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` then `adb reverse tcp:8081 tcp:8081`.
- iOS: deployment target 16.4 (Expo 57 minimum). Pods: Homebrew Ruby + `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`, then `cd ios && bundle exec pod install`. React core is built from source (`RCT_USE_PREBUILT_RNCORE=0` in the Podfile) so the tvos fork is not shadowed by an upstream prebuilt.

## Scripts

```bash
npm run verify              # typecheck + lint + jest
npm start                   # Expo CLI dev server (Metro on 8081)
npm run android / npm run ios
npm run build:android-apk-release
```

## Verification matrix

Run after any player, list, or native change:

- **Android TV emulator**: login/activation, nav rail, Live TV grid + category column, live playback (`native` and `vlc`), remote Up → channel list → Back chain, focus after the list closes (`adb shell dumpsys activity top`, look for the `.F` flag), Movies/Series grids + detail, Settings engine switch, memory at Home (`adb shell dumpsys meminfo`).
- **Android phone emulator**: portrait lock, catalog tabs, system-bar insets, VOD resume + next episode, live channel switch, background → foreground, all three engines.
- **iPhone + iPad simulators**: landscape lock on iPhone only, iPad rotation + grid reflow, VLC live + VOD, background → foreground, engine fallback on an unreachable stream.
- JS bundle sanity without a device:
  `npx expo export:embed --platform ios --dev true --entry-file index.js --bundle-output /tmp/check.bundle --assets-dest /tmp/a`
  (`react-native bundle` is not supported on Expo 57 metro-config; see the Stack section)

## Roadmap (not started)

EPG (now/next → full guide), global search across live/VOD/series, FlashList for the catalog grids, MMKV for hot-path storage, deduplicating the three catalog screens (needs screen tests first), crash reporting, background audio / PiP, automatic engine fallback, TV held-key auto-repeat, catch-up/timeshift, parental PIN.
