# Mirror Redesign — Agent Handoff Context

> Context for continuing the app-wide re-skin to the **"Mirror"** design system.
> Written 2026-06-13. The Home screen + bottom tab bar are done; this doc lets another
> agent re-skin the remaining screens **in parallel** using the same patterns.

---

## 1. Goal

Re-skin the IPTV app to a new dark design system ("Mirror", from a Claude Design handoff):
premium dark UI, **indigo → cyan → magenta** accent triad, gradient surfaces, soft ambient
glows. Must be **color-accurate** to the design. Keep all real data + navigation; only the
visual layer changes.

## 2. Design source (read-only reference)

The original HTML/JSX mockups were extracted to:

```
/tmp/design_extract/iptv-mobile-application/
├── README.md                     # handoff instructions
├── chats/chat1.md                # full design conversation / intent
└── project/
    ├── IPTV Home.html            # entry (tweak defaults live here)
    ├── home.jsx                   # ← Home screen reference (DONE)
    ├── live.jsx                   # ← Live TV reference (categories dropdown, list/grid, search)
    ├── movies.jsx                 # ← Movies reference (portrait posters, searchable category dropdown)
    ├── mirror-tokens.css          # color + type tokens (source of truth)
    └── screenshots/               # rendered reference images
```

> ⚠️ `/tmp` is ephemeral — if it's gone, re-fetch via WebFetch on the design URL
> `https://api.anthropic.com/v1/design/h/aT1CmDCraOvSk8udI1M4TQ` (returns a gzip; `tar -xzf`).
> The README says: recreate **pixel-accurately** in RN, match visual output (don't copy the
> prototype's DOM structure). Don't render the HTML in a browser — read source directly.

## 3. Stack facts (important)

- **Bare React Native 0.84**, React 19.2.3 (NOT Expo). `@react-navigation` stack + bottom-tabs.
- **`npm install` REQUIRES `--legacy-peer-deps`** (react-native-fast-image pins react ≤18 vs the project's react 19). Plain install fails with ERESOLVE.
- Icons: `react-native-vector-icons` (FontAwesome5, MaterialCommunityIcons, Ionicons, MaterialIcons).
- No custom fonts yet — Geist is in the design but not installed. We fall back to system sans + Menlo/monospace.
- **Native deps already added for the redesign:** `react-native-linear-gradient`, `react-native-svg` (pods installed). Adding *more* native deps needs `cd ios && pod install` + a full native rebuild. Pure JS/style changes only need a Metro **reload** (no rebuild).

## 4. Design tokens — `src/theme/colors.ts` (ALREADY EXISTS, import from here)

Always import tokens; never hardcode hex. Exports: `colors`, `sectionAccents`, `radii`, `space`, `gradients`.

```
bg #070b15 · panel #0b1020 · surface #0e1428 · surface2 #111832
fg #f4f6ff · fgMuted #b8bed3 · fgSubtle #7b829a
indigo #8b7bff · cyan #22d3ee · magenta #ff6bd1 · magentaOnAir #ef4fa7
success #10b981 · warning #f59e0b · danger #ef4444
border rgba(255,255,255,0.08) · borderStrong rgba(255,255,255,0.14) · glass rgba(255,255,255,0.04)
radii: sm 8 · md 12 · lg 16 · card 20 · pill 9999
sectionAccents: live=magentaOnAir · movies=indigo · series=cyan
```

Typography helpers used on Home (define the same in new screens):
```ts
const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' }); // ids, counts, stats, dates
```
Eyebrow style = 11px, weight 500, letterSpacing ~1.8, uppercase, color `colors.indigo`.

## 5. CRITICAL pattern — gradient cards without double borders

RN renders a **double-border seam** when a bordered element with `overflow:'hidden'` also
carries a translucent gradient fill (the fill insets 1px from the border). **Do NOT make the
`LinearGradient` itself the bordered card.** Instead:

```tsx
// ✅ Bordered View as the card; gradient/SVG fill as an absolute child that reaches the edge.
<View style={[card, { borderColor: `${accent}30` }]}>{/* borderRadius, borderWidth:1, overflow:'hidden', backgroundColor: base */}
  {/* base + soft accent corner glow via SVG radial that fades BEFORE the edge */}
  <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      <RadialGradient id={`glow-${id}`} cx="2%" cy="2%" r="80%">
        <Stop offset="0%" stopColor={accent} stopOpacity={0.32} />
        <Stop offset="62%" stopColor={accent} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect width="100%" height="100%" fill={baseColor} />
    <Rect width="100%" height="100%" fill={`url(#glow-${id})`} />
  </Svg>
  {/* ...content on top... */}
</View>
```

Rules that fixed real bugs on Home:
- **One border per card.** Never a colored drop-shadow bloom (it reads as a 2nd outer border) — drop `shadowColor/elevation` on accent cards.
- **Glows = SVG `RadialGradient` that fades to opacity 0 before the edge** (NOT a `LinearGradient [color,'transparent']` to the edge, which leaves a bright edge ring; NOT a hard solid circle).
- **Unique SVG gradient `id`s per element** (each `<Svg>` is its own doc, but keep them distinct, e.g. `sec-live`, `sub-halo`).
- **Overflow safety:** in flex rows, give the flexible item `flexShrink:1` + `numberOfLines={1}` and the fixed item `flexShrink:0`. Keep dynamic strings short (e.g. plan label) so they don't push siblings off-screen.

## 6. Icon mapping (lucide → vector-icons)

```
user-round→FA5 user · settings→Ionicons settings-sharp · eye→FA5 eye
triangle-alert→FA5 exclamation-triangle · play→FA5 play (solid) · chevron-right→FA5 chevron-right
radio (Live)→MaterialCommunityIcons radio-tower · clapperboard (Movies)→MCI movie-open · tv (Series)→FA5 tv
search→FA5 search · bookmark→FA5 bookmark · download→FA5 download
```

## 7. Data wiring patterns (reuse these utils)

- Credentials: `useSelector((s: RootState) => s.user)` → `{ username, password, serverDomain, serverPort, useProxy }`.
- Xtream URLs: `src/utils/xtream.ts` → `buildPlayerApiUrl({domain,port,username,password, action})`
  (action is REQUIRED; pass `''` for the user_info/server_info response), `buildLiveStreamUrl`,
  `buildMovieStreamUrl`, `buildSeriesStreamUrl`. Always wrap with `proxyStreamUrl(url, useProxy)` from `src/utils/proxy.ts`.
- Subscription card pulls `res.data.user_info` (`exp_date` unix, `status`, `is_trial`, `created_at`, `max_connections`).
  Far-future `exp_date` (>3650 days) is treated as **Unlimited / ∞** — replicate this guard anywhere expiry is shown.
- Continue-watching: `storage.getLatestWatched()` (`src/utils/storage.ts`) returns `LatestWatched[]`
  (`{ id, name, type: 'movie'|'series'|'live', thumbnail?, progress?, totalDuration?, seriesId?, episodeNumber?, seasonNumber?, channelName? }`). Refresh on `useIsFocused()`.

## 8. Status — DONE

- `src/theme/colors.ts` — token module (new). **Import from here in every screen.**
- `src/screens/HomeScreenBrand.tsx` — full rewrite to Mirror (header w/ gradient avatar ring,
  subscription card wired to real Xtream user_info, 3 stacked section tiles, continue-watching
  rail w/ real data + empty state, ambient SVG glow + grid backdrop). Reference: `home.jsx`.
- `src/screens/TabNavigator.tsx` — re-skinned: active `#8b7bff`, inactive `#7b829a`, glass bg
  `rgba(14,20,40,0.72)`, radius 24, border `rgba(255,255,255,0.08)`. Kept the 5 real tabs
  (Home / LiveTV / Movies / Series / Settings) — do NOT adopt the design's fictional nav items.

## 9. Status — TODO (parallelizable, one screen per agent)

Each screen should import `src/theme/colors.ts`, follow the §5 card pattern, §6 icons, §7 data.
Match the corresponding reference jsx, but **use real data** and **drop dummy counts/stats**
(the user explicitly does not want fabricated numbers like "642 channels").

| Screen | File | Reference | Key design elements |
|---|---|---|---|
| Live TV | `src/screens/LiveTVScreen.tsx` | `project/live.jsx` | Opens on first category's channels; header **category dropdown** (no channel counts in dropdown); **list ⇄ grid** view toggle; channel **search**; logo with **default fallback tile** for channels w/o logos. NO filter pills, NO "LIVE" tag (backend doesn't support). |
| Movies | `src/screens/singleMoviesScreen.tsx` | `project/movies.jsx` | Lands on default category; header dropdown with a **search-categories** field; **portrait 2:3 posters** w/ quality/rating badge + scrim; 2⇄3 col toggle; title/year search. |
| Series | `src/screens/SeriesList.tsx` | (mirror Movies pattern) | Same as Movies (portrait posters, category dropdown). No dedicated reference jsx — adapt movies.jsx. |
| Settings | `src/screens/SettingsScreen.tsx` | `home.jsx` `SettingsSheet` (lines ~549-654) | Subscriber id + device row, list rows (Account, Subscription, Downloads, Notifications, Parental, Help) each w/ indigo icon tile, **Log out** danger button. Logout currently lives here. |

Shared components that may also need restyling: `src/components/CategoryPickerModal.tsx`,
`src/components/ChannelSwitcher.tsx`, `src/components/PlayerControls.tsx`.

Consider extracting shared building blocks as agents go (to `src/components/mirror/`):
`GradientCard`, `AmbientGlow`, `SectionHeader`/eyebrow, `Pill`, `CategoryDropdown`.
Currently these live inline in `HomeScreenBrand.tsx` — lift-and-share rather than copy-paste.

## 10. Optional enhancement — Geist fonts

Design uses **Geist Sans + Geist Mono**. To match exactly: add `.ttf`s to `src/assets/fonts/`,
register in `react-native.config.js` (`assets: ['./src/assets/fonts']`), run `npx react-native-asset`,
rebuild. Until then keep the `FONT`/`MONO` fallbacks. Not started.

## 11. Verify any change (no simulator needed)

```bash
# typecheck only the touched files
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "<YourFile>"
# confirm JS resolves + bundles (catches import/syntax errors)
npx react-native bundle --entry-file index.js --platform ios --dev true \
  --bundle-output /tmp/check.bundle --assets-dest /tmp/assets
```
For visual confirmation, reload Metro (JS changes) or `npx react-native run-ios` after any native dep change.

## 12. Coordination notes for parallel agents

- **Shared file = `src/theme/colors.ts`** (read-only for screen agents; coordinate before editing it).
- `src/screens/TabNavigator.tsx` is shared — avoid editing unless changing nav itself.
- Each screen file in §9 is independent → safe to assign one agent per file/worktree.
- If you add a native dependency, announce it — every other agent then needs a rebuild.
- Keep dummy/sample data OUT; wire real Xtream/storage data per §7.
