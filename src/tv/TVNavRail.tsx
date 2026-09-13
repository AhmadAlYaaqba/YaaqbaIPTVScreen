// src/tv/TVNavRail.tsx
// Left navigation rail used instead of the floating bottom tab bar on TV.
//
// - Solid panel instead of BlurView: live blur is expensive on 2 GB TV devices.
// - Select navigates (not focus) so D-pad travel through the rail doesn't mount
//   heavy catalog screens along the way.
// - TVFocusGuideView autoFocus remembers the last focused item, so moving back
//   into the rail from content restores focus to where the user left it.

import React from 'react';
import { StyleSheet, Text, TVFocusGuideView } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import FocusablePressable from './FocusablePressable';
import { colors, radii, space } from '../theme/colors';

export interface TVNavRailProps extends BottomTabBarProps {
  getLabel: (routeName: string) => string;
  renderIcon: (
    routeName: string,
    color: string,
    size: number,
  ) => React.ReactNode;
}

export default function TVNavRail({
  state,
  navigation,
  getLabel,
  renderIcon,
}: TVNavRailProps) {
  return (
    <TVFocusGuideView autoFocus style={styles.rail}>
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const label = getLabel(route.name);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <FocusablePressable
            key={route.key}
            onPress={onPress}
            focusScale={1}
            style={[styles.item, isActive && styles.itemActive]}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}>
            {({ focused }) => {
              const color =
                focused || isActive ? colors.fg : colors.fgSubtle;
              return (
                <>
                  {renderIcon(route.name, isActive ? colors.indigo : color, 28)}
                  <Text style={[styles.label, { color }]}>{label}</Text>
                </>
              );
            }}
          </FocusablePressable>
        );
      })}
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 120,
    paddingVertical: space.s10,
    paddingHorizontal: space.s3,
    gap: space.s2,
    backgroundColor: colors.panel,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.s3,
    gap: space.s1,
    borderRadius: radii.md,
  },
  itemActive: {
    backgroundColor: 'rgba(139,123,255,0.16)',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
