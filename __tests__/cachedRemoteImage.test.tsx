/* eslint-env jest */

import React from 'react';
import { View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

const mockExpoImageProps: Record<string, any>[] = [];

jest.mock('expo-image', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    Image: (props: Record<string, any>) => {
      mockExpoImageProps.push(props);
      return ReactModule.createElement(ReactNative.View, {
        ...props,
        testID: 'expo-image',
      });
    },
  };
});

const CachedRemoteImage =
  require('../src/components/CachedRemoteImage').default;

describe('CachedRemoteImage', () => {
  beforeEach(() => {
    mockExpoImageProps.length = 0;
  });

  it('uses memory and disk caching, opaque keys, dimensions, and recycling', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CachedRemoteImage
          uri="https://user:password@example.com/poster.jpg"
          playlistId="playlist-secret"
          contentId="movie-42"
          variant="poster"
          style={{ width: 100, height: 150 }}
          displayWidth={100}
          displayHeight={150}
        />,
      );
    });

    const image = renderer!.root.findByProps({ testID: 'expo-image' });
    expect(image.props.cachePolicy).toBe('memory-disk');
    expect(image.props.allowDownscaling).toBe(true);
    expect(image.props.source).toMatchObject({ width: 100, height: 150 });
    expect(image.props.recyclingKey).toBe(image.props.source.cacheKey);
    expect(image.props.source.cacheKey).not.toContain('playlist-secret');
    expect(image.props.source.cacheKey).not.toContain('example.com');

    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('shows a failure fallback and retries when the remote URI changes', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CachedRemoteImage
          uri="https://example.com/failed.jpg"
          playlistId="playlist-a"
          contentId="movie-42"
          variant="poster"
          style={{ width: 100, height: 150 }}
          fallback={<View testID="image-fallback" />}
        />,
      );
    });

    const image = renderer!.root.findByProps({ testID: 'expo-image' });
    ReactTestRenderer.act(() => image.props.onError());
    expect(
      renderer!.root.findByProps({ testID: 'image-fallback' }),
    ).toBeTruthy();

    ReactTestRenderer.act(() => {
      renderer!.update(
        <CachedRemoteImage
          uri="https://example.com/recovered.jpg"
          playlistId="playlist-a"
          contentId="movie-42"
          variant="poster"
          style={{ width: 100, height: 150 }}
          fallback={<View testID="image-fallback" />}
        />,
      );
    });
    expect(renderer!.root.findByProps({ testID: 'expo-image' })).toBeTruthy();

    ReactTestRenderer.act(() => renderer!.unmount());
  });
});
