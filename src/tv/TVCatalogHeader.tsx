// src/tv/TVCatalogHeader.tsx
// Compact content header used on TV in place of the category dropdown trigger
// (categories live in TVCatalogLayout's column). Shows the active category and
// a content-search toggle. There is no back button: the remote's Back key and
// the nav rail cover navigation.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import FocusablePressable from './FocusablePressable';
import { colors, radii, space } from '../theme/colors';

export interface TVCatalogHeaderProps {
  label: string;
  title: string;
  accent: string;
  icon: string;
  onSearchToggle?: () => void;
  searchActive?: boolean;
}

export default function TVCatalogHeader({
  label,
  title,
  accent,
  icon,
  onSearchToggle,
  searchActive = false,
}: TVCatalogHeaderProps) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.iconTile,
          { backgroundColor: `${accent}26`, borderColor: `${accent}55` },
        ]}>
        <FontAwesome5 name={icon} size={16} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title || 'Select a category'}
        </Text>
      </View>
      {onSearchToggle ? (
        <FocusablePressable
          onPress={onSearchToggle}
          focusScale={1.1}
          style={[
            styles.searchBtn,
            searchActive && {
              backgroundColor: `${accent}26`,
              borderColor: `${accent}66`,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            searchActive ? 'Close content search' : 'Open content search'
          }
          accessibilityState={{ selected: searchActive }}>
          <FontAwesome5
            name="search"
            size={16}
            color={searchActive ? accent : colors.fgMuted}
          />
        </FocusablePressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s6,
    paddingTop: space.s5,
    gap: space.s3,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.fg,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
