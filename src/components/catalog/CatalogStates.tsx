import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import { colors, radii } from '../../theme/colors';

const SKELETON_ITEMS = Array.from({ length: 12 }, (_, index) => index);

export function CatalogGridSkeleton({
  accent,
  itemWidth,
  itemHeight,
  gutter,
}: {
  accent: string;
  itemWidth: number;
  itemHeight: number;
  gutter: number;
}) {
  return (
    <View style={[styles.skeletonGrid, { gap: gutter }]}>
      {SKELETON_ITEMS.map(item => (
        <View
          key={item}
          style={[
            styles.skeletonCard,
            {
              width: itemWidth,
              height: itemHeight,
              borderColor: `${accent}22`,
            },
          ]}
        >
          <View style={[styles.skeletonGlow, { backgroundColor: `${accent}12` }]} />
        </View>
      ))}
    </View>
  );
}

export function CatalogStatus({
  kind,
  title,
  message,
  accent,
  onRetry,
}: {
  kind: 'empty' | 'error' | 'offline';
  title: string;
  message?: string | null;
  accent: string;
  onRetry?: () => void;
}) {
  const icon =
    kind === 'offline'
      ? 'wifi'
      : kind === 'error'
        ? 'exclamation-circle'
        : 'inbox';

  return (
    <View style={styles.status}>
      <FontAwesome5
        name={icon}
        size={34}
        color={kind === 'error' ? colors.danger : colors.fgSubtle}
      />
      <Text style={styles.statusTitle}>{title}</Text>
      {message ? <Text style={styles.statusMessage}>{message}</Text> : null}
      {onRetry ? (
        <TouchableOpacity
          style={[styles.retryButton, { borderColor: `${accent}66` }]}
          activeOpacity={0.8}
          onPress={onRetry}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
  },
  skeletonCard: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: colors.glass,
  },
  skeletonGlow: {
    flex: 1,
    margin: 8,
    borderRadius: radii.sm,
  },
  status: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  statusTitle: {
    color: colors.fg,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  statusMessage: {
    color: colors.fgMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: colors.glass,
  },
  retryText: {
    color: colors.fg,
    fontWeight: '600',
  },
});
