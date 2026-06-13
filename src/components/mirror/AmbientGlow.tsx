import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Circle,
} from 'react-native-svg';

import { colors } from '../../theme/colors';

// ─────────────────────────────────────────────────────────────
// Ambient glow — soft radial halos for the Mirror theme.
//
//  • Default (no `accent`): the triad cluster used on Home.
//  • With `accent`: a single category-tinted halo (top-right) that
//    fades before the edge — used by Live / Movies / Series headers.
// ─────────────────────────────────────────────────────────────
export default function AmbientGlow({ accent }: { accent?: string }) {
  if (accent) {
    return (
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgRadialGradient id="halo-accent" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={accent} stopOpacity={0.42} />
            <Stop offset="70%" stopColor={accent} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Circle cx="96%" cy="-6%" r={500} fill="url(#halo-accent)" />
      </Svg>
    );
  }

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgRadialGradient id="halo-indigo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.indigo} stopOpacity={0.5} />
          <Stop offset="60%" stopColor={colors.indigo} stopOpacity={0} />
        </SvgRadialGradient>
        <SvgRadialGradient id="halo-magenta" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.45} />
          <Stop offset="60%" stopColor={colors.magenta} stopOpacity={0} />
        </SvgRadialGradient>
        <SvgRadialGradient id="halo-cyan" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.cyan} stopOpacity={0.4} />
          <Stop offset="65%" stopColor={colors.cyan} stopOpacity={0} />
        </SvgRadialGradient>
      </Defs>
      {/* top-right triad cluster */}
      <Circle cx="78%" cy="2%" r={230} fill="url(#halo-indigo)" />
      <Circle cx="100%" cy="14%" r={200} fill="url(#halo-magenta)" />
      <Circle cx="62%" cy="-4%" r={190} fill="url(#halo-cyan)" />
      {/* lower-left cyan */}
      <Circle cx="-6%" cy="42%" r={200} fill="url(#halo-cyan)" />
    </Svg>
  );
}
