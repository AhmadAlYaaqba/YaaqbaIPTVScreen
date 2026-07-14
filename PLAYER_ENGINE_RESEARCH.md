# Player Engine Research — VLC alternatives & control strategy

> Deep-dive (2026-07-14) into: better-maintained VLC wrappers for React Native,
> alternative engines, and the "own the wrapper" path.
> Companion doc to [ENHANCEMENT_PLAN.md](ENHANCEMENT_PLAN.md) §1.

## TL;DR recommendation

1. **Best candidate to replace `rn-vlc-plyr`: [`expo-libvlc-player`](https://github.com/cornejobarraza/expo-libvlc-player).**
   It is by far the most actively maintained VLC wrapper in the RN ecosystem
   (v7.1.6 released **2026-07-11**, 701 commits, 244 releases) and exposes the
   exact control surface we're missing: libVLC `options` (→ `network-caching`),
   audio/video/subtitle track selection, external subtitle `slaves`,
   `aspectRatio`/`scale`/`contentFit`, `rate`, initial `time` (kills our
   200 ms-setTimeout seek hack), PiP, snapshot/record, and a rich event set
   (`onESAdded`, `onBuffering`, `onTimeChanged`, background/foreground).
2. **Fallback / parallel path: fork `rn-vlc-plyr`.** We already maintain a
   patch against it; the codebase is tiny (34 commits) and Fabric-native. A
   fork gives us 100 % control (add media options, `setMedia()` zapping,
   tracks) without betting on a third party.
3. **Don't switch engines (mpv / KSPlayer / AVPlayer) today.** mpv wrappers are
   Android-only or untested on iOS; KSPlayer is GPL and has no RN wrapper;
   AVPlayer can't do raw TS — the reason we use VLC in the first place.

---

## 1. Current library: `rn-vlc-plyr` (what we use)

| | |
|---|---|
| Maintenance | Solo maintainer, ~20 stars, 34 commits, beta version (`0.2.9-beta.3`) — we already carry a local patch to make events work |
| iOS engine | MobileVLCKit **3.7.2** (the 3.x line is in maintenance mode) |
| API surface | `url / autoPlay / loop / muted` + play/pause/stop/seek/setVolume — **no** caching options, tracks, aspect ratio, rate, or PiP |
| New Arch | Yes (Fabric codegen) — one of the few that is |

Verdict: architecture-correct but feature-starved and effectively unmaintained.
Anything we need, we have to patch in ourselves.

## 2. Candidate: `expo-libvlc-player` ⭐ recommended

Repo: https://github.com/cornejobarraza/expo-libvlc-player

| | |
|---|---|
| Maintenance | **v7.1.6 on 2026-07-11 (days old)**, 701 commits, 244 releases, issues actively closed |
| iOS engine | **VLCKit 4.0.0a20** — the libVLC-4 line (modern core, better hw pipeline) |
| Android engine | `org.videolan.android:libvlc-all:3.7.5` (current stable) |
| Requirements | RN 0.83+ (we're on 0.84 ✅), iOS 15.1+, Android 7+; works in **bare RN** via Expo Modules (`npx install-expo-modules`) |
| New Arch | Expo Modules API — New-Architecture compatible by design (RN 0.83+ requirement implies it) |

**Control surface we gain (the whole point):**

- `options: string[]` — libVLC media/init options: `:network-caching=`,
  `:live-caching=`, clock/jitter, deinterlace, hw-decode toggles → the #1
  performance lever ([option reference](https://wiki.videolan.org/VLC_command-line_help/))
- `tracks` (audio/video/subtitle IDs) + `onESAdded` (track discovery) → track picker UI
- `slaves` — external subtitle/audio files
- `aspectRatio`, `scale`, `contentFit` — SD channel fixes
- `rate`, `volume`, `mute`, initial `time` (native continue-watching seek)
- `pictureInPicture` + start/stop methods, `record()`, `snapshot()`
- Events: `onBuffering`, `onPlaying/Paused/Stopped`, `onEncounteredError`,
  `onTimeChanged`, `onPositionChanged`, `onFirstPlay`, `onBackground/Foreground`

**Risks / caveats:**

- iOS uses VLCKit **4.0 alpha** (a20). VLCKit 4 final isn't out; VideoLAN ships
  alphas on CocoaPods/SPM ([status](https://code.videolan.org/videolan/VLCKit/-/tags)). Must be validated against our worst provider streams.
- Requires adding the `expo` package to our bare RN app (supported, adds a
  little native init; we can keep everything else bare).
- Solo maintainer too — but with 20× the activity, and worst case we fork it
  (Expo Modules Swift/Kotlin is far easier to own than raw Fabric C++/codegen).
- Documented known issues: Android black screen on screen switch, iOS black
  screen after background pause — both with documented workarounds.

## 3. Candidate: `react-native-vlc-media-player` (razorRun) — most popular, not recommended

Repo: https://github.com/razorRun/react-native-vlc-media-player

- Most-used VLC wrapper (npm `react-native-vlc-media-player`), but last release
  **June 2025** (v1.0.98) and slowing.
- iOS pinned to **MobileVLCKit 3.3.10** (2021-era core — older than what we run today).
- **Old architecture.** Fabric migration is an open community struggle
  (event-emitter issues under New Arch; interop-layer edge cases with view
  commands/events — exactly what a player needs). On RN 0.84 New Arch this is
  a real stability risk, not a paper concern.
- Does expose `videoAspectRatio`, `audioTrack`/`textTrack`, `rate`,
  recording/snapshot — good features, wrong foundation for our stack.

## 4. Alternative engine: mpv (libmpv) — watch, don't adopt

mpv is arguably the best OSS playback engine for messy IPTV streams (superior
buffering/cache control, ffmpeg-everything). RN state in 2026:

- [`react-native-video-mpv`](https://github.com/pigeonmal/react-native-video-mpv) — Fabric component, active (v0.2.0 Nov 2025), **Android only**.
- [`expo-mpv`](https://www.jsdelivr.com/package/npm/expo-mpv) / `expo-libmpv` — Expo module over libmpv; iOS "contributions welcome / untested". **GPL-3** licensing.
- [`Dusk-Labs/react-native-mpv`](https://github.com/Dusk-Labs/react-native-mpv) — stale.
- iOS building blocks exist ([MPVKit](https://github.com/mpvkit/MPVKit)) but we'd write the whole iOS wrapper ourselves, and GPL builds of ffmpeg/mpv complicate App Store distribution.

Verdict: revisit in 12 months; today it doesn't solve iOS, which is our problem platform.

## 5. Alternative engine: KSPlayer — powerful, blocked by license

[KSPlayer](https://github.com/kingslay/KSPlayer): AVPlayer + FFmpeg hybrid for
iOS/tvOS/macOS, HDR/Dolby, image+text subs, actively maintained. Used by several
commercial IPTV apps. But: **GPL by default (LGPL is paid)**, Swift-only, no RN
wrapper — we'd build an Expo module *and* buy a license. Only worth it if VLC
fundamentally can't hit our quality bar.

## 6. "Build it ourselves" — how controllable can we get?

Two realistic ownership levels (we already do level 0 = patch-package):

**A. Fork `rn-vlc-plyr`** (Fabric codegen, Kotlin/ObjC)
   - Effort: low-medium — we know the code (our patch touches its internals).
   - Add: `mediaOptions`/`initOptions` props, `setMedia()`-based URL change
     (fast zapping without view remount), track APIs, aspect ratio, rate.
   - Keeps MobileVLCKit 3.7.x (stable, known quantity).

**B. Own Expo Module wrapping VLCKit** (Swift/Kotlin via [Expo Modules API](https://docs.expo.dev/modules/overview/))
   - This is exactly what `expo-libvlc-player` already is — so the pragmatic
     version of "build our own" is: **adopt it, and fork it if the maintainer
     disappears or we need custom behavior** (e.g., pre-buffered dual-player
     channel zapping, custom stall telemetry).
   - Expo Modules is the easiest wrapper tech to maintain long-term (typed
     Swift/Kotlin DSL, no C++/codegen), and works in our bare RN app.

## 7. libVLC options worth exposing/tuning (once we have `options` control)

| Option | Use |
|---|---|
| `:network-caching=<ms>` | Core buffer size. Live: 1500–3000; VOD: 3000–8000. User setting: "Low latency / Balanced / Stable" |
| `:live-caching=<ms>` | Capture/live-specific caching |
| `:clock-jitter=0` / `:clock-synchro=0` | Smooths badly-muxed provider TS streams |
| `:drop-late-frames` / `:skip-frames` | Trade smoothness vs sync on weak devices (on by default; disabling can help judder) |
| `:codec=...` / hw-decode flags | Verify VideoToolbox hw decode for H.264/H.265 (4K H.265 at <20% CPU vs 100% in software) |
| `:http-reconnect` | Auto-reconnect HTTP streams at the engine level (before our JS backoff even fires) |
| `:deinterlace=1 --deinterlace-mode=yadif` | Interlaced SD channels |
| `:adaptive-maxwidth/-maxheight` | Cap HLS variant selection on small screens (bandwidth) |

## 8. Proposed migration plan (feeds ENHANCEMENT_PLAN §1)

1. **Spike (1–2 days):** branch + `npx install-expo-modules`, swap the internals
   of [VLCPlyrPlayer.tsx](src/components/VLCPlyrPlayer.tsx) to `LibVlcPlayerView`
   behind the same props interface (our screen/hook layer doesn't change).
2. **Validate matrix:** worst provider streams — live raw TS, live HLS, VOD mkv
   (multi-audio + subs), 4K H.265, seek/resume, channel zap speed, background→
   foreground, kill/relaunch. Compare vs current player on the same device.
3. **Tune:** live/VOD `options` presets + Settings "buffer profile"; wire track
   picker + aspect ratio into PlayerControls.
4. **Decide:** ship it (keep `useVLC` toggle as escape hatch) — or, if VLCKit 4
   alpha misbehaves, fall back to **forking rn-vlc-plyr** and porting the same
   features onto MobileVLCKit 3.7.
5. **Exit criteria for rn-vlc-plyr removal:** 2 weeks of field use, no new
   crash signatures, zap time ≤ current, rebuffer rate ≤ current.

## Sources

- https://github.com/cornejobarraza/expo-libvlc-player (+ its README, podspec `VLCKit 4.0.0a20`, gradle `libvlc-all:3.7.5`, releases API)
- https://github.com/amerllica/rn-vlc-plyr
- https://github.com/razorRun/react-native-vlc-media-player · https://www.npmjs.com/package/react-native-vlc-media-player
- https://code.videolan.org/videolan/VLCKit/-/tags · https://github.com/videolan/vlckit · https://wiki.videolan.org/VLCKit/
- https://github.com/pigeonmal/react-native-video-mpv · https://github.com/Dusk-Labs/react-native-mpv · https://github.com/mpvkit/MPVKit · https://www.jsdelivr.com/package/npm/expo-mpv
- https://github.com/kingslay/KSPlayer
- https://docs.expo.dev/modules/overview/ · https://docs.expo.dev/modules/third-party-library/
- https://www.feepk.net/2018/02/19/vlckit-3-0/ (hw decode numbers)
- https://wiki.videolan.org/VLC_command-line_help/ (options reference)
