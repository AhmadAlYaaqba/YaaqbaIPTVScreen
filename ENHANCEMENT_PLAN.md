# YaaqbaIPTV — Enhancement & Performance Plan

> Tracking document for stability, performance, and feature work.
> Status legend: `[ ]` todo · `[~]` in progress · `[x]` done
> Priority: **P0** = stability/perf critical · **P1** = high value · **P2** = nice to have
>
> Context: bare RN 0.84 + React 19, New Architecture + Hermes enabled. Player is
> `rn-vlc-plyr` (MobileVLCKit 3.7.2, locally patched) on iOS/optionally Android,
> with `react-native-video` (ExoPlayer) as the native alternative. App is a
> provider-agnostic Xtream-codes IPTV client — VLC chosen because iOS AVPlayer
> does not handle raw TS / non-standard IPTV streams.

---

## 1. Video Player — VLC engine (biggest impact area)

> **Direction decided by research (see [PLAYER_ENGINE_RESEARCH.md](PLAYER_ENGINE_RESEARCH.md)):**
> evaluate migrating from `rn-vlc-plyr` to **`expo-libvlc-player`** (actively
> maintained, VLCKit 4, exposes libVLC `options`, tracks, aspect ratio, PiP,
> initial `time`). Fallback: fork `rn-vlc-plyr` and add the same capabilities.
> Most items below come "for free" with the migration; they remain listed as
> the requirements checklist either way.

- [ ] **P0 — Spike: swap `VLCPlyrPlayer` internals to `expo-libvlc-player`**
  behind the same props interface; validate against worst provider streams
  (raw TS live, multi-audio mkv VOD, H.265, zap speed, background/foreground).
  Go/no-go per the migration plan in PLAYER_ENGINE_RESEARCH.md §8.

The current `rn-vlc-plyr` wrapper exposes only `url / autoPlay / loop / muted` and
5 commands. If the spike fails, everything below needs the library patched (we
already maintain a patch: `patches/rn-vlc-plyr+0.2.9-beta.3.patch`) or a fork.

- [ ] **P0 — Expose VLC init/media options (`network-caching`, `live-caching`)**
  Currently VLC runs with default caching (~1000 ms hardcoded in the lib).
  Add an `initOptions` / `mediaOptions` prop plumbed to `VLCMedia` options:
  - Live: `:network-caching=1500–3000` (tunable), `:live-caching`
  - VOD: larger cache (5000+) for fewer rebuffers on weak providers
  - Consider a user-facing "Buffer size: Low latency / Balanced / Stable" setting
  Files: patch `node_modules/rn-vlc-plyr/ios/*` + `android/.../RnVlcPlyrView.kt`,
  wire through [VLCPlyrPlayer.tsx](src/components/VLCPlyrPlayer.tsx).

- [ ] **P0 — Confirm/force hardware decoding on iOS**
  MobileVLCKit software-decodes some codecs (H.265 especially) → hot device,
  battery drain, dropped frames. Ensure `--codec` / hw decoder options are on
  and add a fallback toggle in Settings ("Hardware acceleration").

- [ ] **P0 — Fix: source-fallback chain does not apply to the VLC player**
  `useVideoPlayer` builds a 3-source fallback (proxied HLS → TS → direct HLS) but
  [VideoPlayerScreen.tsx:364](src/screens/VideoPlayerScreen.tsx:364) feeds VLC a
  fixed `uri`, ignoring `player.currentSource`. On VLC, `tryNextSource()`
  increments the index with no effect — retries just remount the same URL.
  Feed `player.currentSource.uri` to VLC too (VLC plays both HLS and raw TS, so
  the same chain works).

- [ ] **P1 — Channel zapping without full remount**
  Today every channel switch / reconnect remounts the whole native view
  (`key={playerKey}-{streamId}`), which tears down and recreates the VLC
  media player + surface (slow, visible black gap). Patch the lib so a `url`
  prop change calls `setMedia()` on the existing player instead. Target: sub-second zap.

- [ ] **P1 — Audio & subtitle track selection**
  IPTV streams often carry multiple audio languages and teletext/DVB subs.
  Expose `getAudioTracks/getSubtitleTracks` + `setAudioTrack/setSubtitleTrack`
  from VLC, add a track-picker button in [PlayerControls.tsx](src/components/PlayerControls.tsx).
  (ExoPlayer path: `react-native-video` already supports `selectedAudioTrack` /
  `textTracks` — wire the same UI.)

- [ ] **P1 — Aspect-ratio / resize mode control**
  Add fill / 16:9 / 4:3 / fit cycling button (VLC `videoAspectRatio`), common
  IPTV need for badly-flagged SD channels.

- [ ] **P1 — Replace the `setTimeout(200ms)` continue-time seek hack**
  [VLCPlyrPlayer.tsx:87](src/components/VLCPlyrPlayer.tsx:87) seeks on a timer
  after `onLoad`. Seek natively on the first `playing`/`ESAdded` event instead —
  the timer races with slow streams and sometimes lands at 0:00.

- [ ] **P2 — Playback speed control (VOD)** — VLC `rate`; simple prop + UI.
- [ ] **P2 — Picture-in-Picture for the VLC path** (native player already sets
  `enterPictureInPictureOnLeave`); background-audio mode for radio channels.
- [ ] **P2 — Evaluate VLCKit 4.x / alternative engines** (KSPlayer, mpv-based)
  once stable; MobileVLCKit 3.7 is in maintenance mode.

## 2. Playback resilience & reconnection

`useVideoPlayer` already has exponential backoff, stall detection, and app-resume
refresh — good base. Gaps:

- [ ] **P0 — Reduce re-render pressure from `onProgress`**
  Every progress tick calls `setCurrentTime` →
  re-renders `VideoPlayerScreen` + `PlayerControls` ~1–4×/sec during playback.
  Keep time in a ref and update the seek-bar UI on a throttle (e.g. 1 Hz via a
  dedicated memoized time component), or drive it with Reanimated shared values.

- [ ] **P1 — VOD retry** — currently any VOD error is terminal
  ([useVideoPlayer.ts:354](src/hooks/useVideoPlayer.ts:354)); add 2–3 resume-at-
  position retries before surfacing the error.

- [ ] **P1 — Network-aware reconnect** — add `@react-native-community/netinfo`:
  pause the backoff loop while offline, reconnect immediately on connectivity
  restore instead of burning retry attempts, show "No connection" state
  distinct from "stream down".

- [ ] **P1 — Smarter stall detection for live** — the 15 s buffering timer is a
  good start; also detect *frozen* playback (state = playing but `currentTime`
  not advancing for N seconds), which VLC often reports on dead TS streams.

- [ ] **P2 — Stream health telemetry in dev overlay** — bitrate, buffer fill,
  dropped frames (extend `DevStreamDebugOverlay`, currently commented out).

## 3. App performance

- [ ] **P0 — Persist the Xtream catalog (channels/movies/series) to disk**
  All lists live only in Redux → every cold start re-downloads full
  `get_live_streams` / VOD lists (can be tens of MB / 30k+ items on real
  providers). Cache per-playlist with a TTL (e.g. 12–24 h) + pull-to-refresh.
  Recommended: move Xtream fetching from `createAsyncThunk`+axios to React Query
  (already installed, used only for TMDB) with a disk persister — gives caching,
  dedupe, retry and stale-while-revalidate for free.

- [ ] **P0 — Replace AsyncStorage with MMKV (`react-native-mmkv`)**
  Storage is on the hot path: watch-progress read-modify-write of a growing JSON
  blob every 30 s during playback, per-item reads in `getLatestWatched`
  ([storage.ts:194](src/utils/storage.ts:194) does N sequential reads). MMKV is
  synchronous and ~30× faster; also fixes the N+1 by storing progress per key.

- [ ] **P1 — Lists: migrate heavy grids to FlashList**
  FlatLists are reasonably tuned (`windowSize`, `initialNumToRender`) but with
  10k+ channel/VOD lists, `@shopify/flash-list` v2 (new-arch native) will cut
  memory and scroll jank. Priority screens: LiveTVScreen, MoviesScreen /
  singleMoviesScreen, SeriesList, ChannelSwitcher.

- [ ] **P1 — Image loading: replace `react-native-fast-image`**
  Unmaintained and known-problematic on Fabric/New Arch. Options:
  `expo-image` (works in bare RN) or RN 0.84's improved built-in `Image`.
  Add explicit `recyclingKey`/downsampling for poster grids.

- [ ] **P1 — Search index for large catalogs** — client-side search over 30k
  titles currently means `filter()` on the JS thread per keystroke wherever
  search exists; debounce input + pre-normalized lowercase index (or move list
  filtering into a memoized selector).

- [ ] **P1 — Startup time** — defer TMDB matching and home-rail hydration until
  after first paint; lazy-load screens with `React.lazy`/dynamic `require` so
  Login → Home isn't blocked by player/TMDB modules.

- [ ] **P2 — Redux hygiene** — normalize catalog state (byId maps) so category
  switches don't clone huge arrays; use `createEntityAdapter`.

## 4. Code quality & architecture (stability)

- [ ] **P0 — Add crash & error reporting (Sentry)** — a beta VLC bridge +
  provider streams *will* crash in the field; without reporting you're blind.
  Include JS + native (NSException / NDK) capture.

- [ ] **P0 — Global error boundary** — one bad API payload currently white-screens
  the app. Wrap navigator with a boundary + "reload app" action.

- [ ] **P1 — Delete dead screens & duplicates**
  `LoginScreen`, `LoginScreen2`, `LoginScreen3` (LoginScreen4 is live),
  `MoviesScreen` vs `singleMoviesScreen` vs `MovieListScreen`,
  `SeriesList` vs `SeriesListScreen`, `HomeScreen` vs `HomeScreenBrand`,
  `LiveScreen` vs `LiveTVScreen` vs `LiveChannelsScreen`. Keep one of each,
  remove the rest — big win for maintainability and bundle size.

- [ ] **P1 — Harden Xtream API types** — `iptvSlice.ts` types are partial and
  payloads are trusted (`response.data` used as-is). Real providers return
  malformed JSON, numbers-as-strings, missing fields. Add a thin validation/
  normalization layer (zod or manual guards) at the fetch boundary.

- [ ] **P1 — Proxy strategy** — `https://v0-next-js-proxy-api.vercel.app` is
  hardcoded ([proxy.ts:1](src/utils/proxy.ts:1)): single point of failure, adds
  latency to every stream byte, and free-tier Vercel will throttle/limit
  long-lived TS streams. Make the proxy URL configurable in Settings, default
  proxy OFF for VLC (VLC talks to providers directly just fine — that's why
  it was chosen), and only auto-enable per-playlist when direct playback fails.

- [ ] **P1 — Fix recently-watched save on mount** —
  [VideoPlayerScreen.tsx:285](src/screens/VideoPlayerScreen.tsx:285) runs once
  with `progress: 0` and `player.duration` still `0`; save it after `onLoad`
  or on exit with real values.

- [ ] **P2 — Remove remaining `console.log`s in hot paths** (most are `__DEV__`-
  guarded already — audit the rest), strip with babel plugin in release.
- [ ] **P2 — Unit tests for the critical logic** — `useVideoPlayer` reconnect
  state machine, `xtream.ts` URL builders, `storage.ts`, `titleNormalize`.
- [ ] **P2 — Enable ProGuard/R8 + resource shrinking for Android release**
  (`enableProguardInReleaseBuilds = false` today) with keep-rules for libvlc;
  add ABI splits / App Bundle to cut APK size.

## 5. User-facing features (IPTV player competitive set)

- [ ] **P1 — EPG (TV guide)** — the single biggest missing IPTV feature. Xtream
  exposes `get_short_epg` / `get_simple_data_table` + XMLTV. Phase 1: now/next
  on the channel list & player overlay. Phase 2: full grid guide. Cache EPG in
  SQLite/MMKV, refresh in background.
- [ ] **P1 — Favorites** — per-playlist favorite channels/movies/series, a
  Favorites category pinned first, long-press to toggle.
- [ ] **P1 — Global search** — one search across live/VOD/series (currently
  browsing is category-drill-down only).
- [ ] **P1 — Continue Watching rail improvements** — resume prompt ("Resume from
  1:23:45 / Start over"), progress bars on posters (data already stored).
- [ ] **P2 — Channel number zapping & prev-channel swipe** in the player
  (ChannelSwitcher exists; add number pad + swipe up/down to zap).
- [ ] **P2 — Catch-up / timeshift** for providers that support Xtream
  `streaming/timeshift.php`.
- [ ] **P2 — Parental control** — PIN-lock categories (Xtream flags adult cats).
- [ ] **P2 — Chromecast / AirPlay** — AirPlay works naturally only on the
  AVPlayer path; for VLC investigate `VLCRendererDiscoverer` (Chromecast).
- [ ] **P2 — Sleep timer, "auto-start last channel" option.**
- [ ] **P2 — VOD download for offline** (only where provider allows direct mp4).

## 6. Suggested execution order

| Phase | Scope | Items |
|---|---|---|
| 1 — Stabilize | crash visibility + player correctness | Sentry, error boundary, VLC source-fallback fix, VOD retry, netinfo-aware reconnect |
| 2 — Player perf | VLC engine tuning | caching options, hw decode, progress-tick re-render fix, seek-hack fix, channel zap without remount |
| 3 — App perf | data & lists | catalog disk cache (React Query), MMKV migration, FlashList, image lib swap |
| 4 — Cleanup | maintainability | dead-screen deletion, API validation layer, proxy default-off, R8/ProGuard |
| 5 — Features | user value | EPG, favorites, global search, track selection UI, aspect ratio |

---

## Notes / decisions log

- 2026-07-14: Plan created from codebase audit on `feature/multiple-providers`.
- VLC remains the default engine on iOS (provider protocol coverage: raw TS,
  odd HLS variants); ExoPlayer remains available on Android via the `useVLC`
  setting.
