import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Image as ExpoImage,
  type ImageContentFit,
  type ImageProps as ExpoImageProps,
} from 'expo-image';

import {
  buildCachedImageKey,
  buildImageSourceToken,
  type CachedImageVariant,
} from '../utils/imageCache';
import { colors } from '../theme/colors';

const PLACEHOLDER = {
  blurhash: 'L02rs+00fQ00~qM{M{M{00M{t7of',
  width: 16,
  height: 16,
};

interface CachedRemoteImageProps {
  uri?: string | null;
  playlistId?: string | null;
  contentId: string | number;
  variant: CachedImageVariant;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  priority?: ExpoImageProps['priority'];
  recyclingKey?: string;
  displayWidth?: number;
  displayHeight?: number;
  fallback?: React.ReactNode;
  accessibilityLabel?: string;
}

const CachedRemoteImage = React.memo(function CachedRemoteImage({
  uri,
  playlistId,
  contentId,
  variant,
  style,
  contentFit = 'cover',
  priority = 'normal',
  recyclingKey,
  displayWidth,
  displayHeight,
  fallback,
  accessibilityLabel,
}: CachedRemoteImageProps) {
  const cacheKey = useMemo(
    () => buildCachedImageKey({ playlistId, contentId, variant }),
    [contentId, playlistId, variant],
  );
  const sourceToken = uri ? buildImageSourceToken(cacheKey, uri) : cacheKey;
  const [failedSourceToken, setFailedSourceToken] = useState<string | null>(
    null,
  );
  const failed = !uri || failedSourceToken === sourceToken;
  const source = useMemo(
    () => ({
      uri: uri || undefined,
      cacheKey,
      width: displayWidth,
      height: displayHeight,
    }),
    [cacheKey, displayHeight, displayWidth, uri],
  );
  const handleError = useCallback(() => {
    setFailedSourceToken(sourceToken);
  }, [sourceToken]);

  return (
    <View
      style={[styles.frame, style as StyleProp<ViewStyle>]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}>
      {failed ? (
        fallback || <View style={styles.fallback} />
      ) : (
        <ExpoImage
          source={source}
          placeholder={PLACEHOLDER}
          placeholderContentFit={contentFit}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey || cacheKey}
          priority={priority}
          transition={120}
          allowDownscaling
          enforceEarlyResizing
          style={StyleSheet.absoluteFill}
          accessible={false}
          onError={handleError}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
  },
});

export default CachedRemoteImage;
