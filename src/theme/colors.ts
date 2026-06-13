// ─────────────────────────────────────────────────────────────
// Mirror Design System — color & layout tokens
// Mirrored from the Claude Design handoff (IPTV Home "Mirror" theme).
// Premium dark UI built on an indigo → cyan → magenta accent triad.
// ─────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg: '#070b15', // home root
  scene: '#05070e', // deepest scene backdrop
  panel: '#0b1020',
  surface: '#0e1428',
  surface2: '#111832',

  // Text
  fg: '#f4f6ff',
  fgMuted: '#b8bed3',
  fgSubtle: '#7b829a',

  // Accent triad
  indigo: '#8b7bff',
  cyan: '#22d3ee',
  magenta: '#ff6bd1',
  magentaOnAir: '#ef4fa7', // the "on-air" magenta used for Live

  // Semantic status
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',

  // Borders (over the dark bg)
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',

  // Surfaces / overlays
  glass: 'rgba(255,255,255,0.04)',
  scrim: 'rgba(4,6,14,0.6)',
  white: '#ffffff',
} as const;

// Per-section accents for the Live / Movies / Series tiles
export const sectionAccents = {
  live: colors.magentaOnAir, // magenta — "on air"
  movies: colors.indigo,
  series: colors.cyan,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 20,
  pill: 9999,
} as const;

export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
} as const;

// The signature triad gradient (used for the avatar ring & ambient glow).
// from 140deg, #8b7bff → #22d3ee → #ff6bd1 → #8b7bff
export const gradients = {
  triad: ['#8b7bff', '#22d3ee', '#ff6bd1', '#8b7bff'],
  progress: ['#8b7bff', '#22d3ee'],
  progressWarning: ['#ff6bd1', '#f59e0b'],
} as const;

export type Colors = typeof colors;
