/* eslint-env jest */

import React from 'react';
import { FlatList } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();
const mockRefetch = jest.fn();
const mockGetAllProgress = jest.fn(() =>
  Promise.resolve({
    'series-7_episode-1': {
      progress: 600,
      totalDuration: 1800,
      timestamp: 1,
    },
  }),
);

const seasonOneEpisodes = Array.from({ length: 24 }, (_, index) => ({
  id: `episode-${index + 1}`,
  title: `Episode ${index + 1}`,
  episode_num: index + 1,
  container_extension: 'mkv',
  info: {
    duration: '00:30:00',
    plot: `Synopsis ${index + 1}`,
  },
}));

const mockSeriesDetailsQuery = {
  data: {
    info: {
      name: 'Test Series',
      episode_run_time: 30,
      cover: 'https://images.example/cover.jpg',
      cast: 'Actor One, Actor Two',
    },
    episodes: {
      '1': seasonOneEpisodes,
      '2': [
        {
          id: 'season-2-episode-1',
          title: 'Season Two Premiere',
          episode_num: 1,
          container_extension: 'mp4',
          info: { duration: '00:45:00' },
        },
      ],
    },
  },
  isPending: false,
  isRefetching: false,
  error: null,
  refetch: mockRefetch,
};

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        playlistId: 'playlist-1',
        username: 'user',
        password: 'pass',
        serverDomain: 'example.com',
        serverPort: '443',
        useProxy: false,
      },
    }),
}));

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../src/components/CachedRemoteImage', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: (props: unknown) =>
      ReactModule.createElement(ReactNative.View, props),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: (props: unknown) =>
      ReactModule.createElement(ReactNative.View, props),
  };
});

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: (props: unknown) =>
      ReactModule.createElement(ReactNative.View, props),
  };
});

jest.mock('../src/services/xtream/xtreamQueries', () => ({
  getXtreamErrorMessage: () => null,
  useXtreamSeriesDetails: () => mockSeriesDetailsQuery,
}));

jest.mock('../src/hooks/useTmdbMatch', () => ({
  useTmdbMatch: () => ({ media: null, loading: false }),
  useTmdbDetails: () => ({ details: null, loading: false }),
  useTmdbSeasonEpisodes: () => ({ episodes: [], loading: false }),
}));

jest.mock('../src/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false }),
}));

jest.mock('../src/utils/storage', () => ({
  storage: { getAllProgress: mockGetAllProgress },
}));

const SeriesDetailScreen = require('../src/screens/SeriesDetailScreen').default;

function getEpisodeList(root: ReactTestRenderer.ReactTestInstance) {
  const list = root
    .findAllByType(FlatList)
    .find(candidate => candidate.props.horizontal !== true);
  if (!list) {
    throw new Error('Episode FlatList was not rendered');
  }
  return list;
}

describe('SeriesDetailScreen virtualization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders virtualized episode and cast collections and bulk-loads progress once', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SeriesDetailScreen
          route={{
            key: 'series-detail',
            name: 'SeriesDetail',
            params: {
              seriesId: 'series-7',
              seriesName: 'Test Series',
            },
          }}
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
            setOptions: mockSetOptions,
          }}
        />,
      );
    });

    const episodeList = getEpisodeList(renderer!.root);
    const castList = renderer!.root
      .findAllByType(FlatList)
      .find(candidate => candidate.props.horizontal === true);
    expect(episodeList.props.data).toHaveLength(24);
    expect(episodeList.props.initialNumToRender).toBe(6);
    expect(episodeList.props.windowSize).toBe(7);
    expect(castList?.props.data).toHaveLength(2);
    expect(castList?.props.windowSize).toBe(5);
    expect(mockGetAllProgress).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('switches seasons and navigates using the selected season episode list', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SeriesDetailScreen
          route={{
            key: 'series-detail',
            name: 'SeriesDetail',
            params: {
              seriesId: 'series-7',
              seriesName: 'Test Series',
            },
          }}
          navigation={{
            navigate: mockNavigate,
            goBack: mockGoBack,
            setOptions: mockSetOptions,
          }}
        />,
      );
    });

    const seasonButton = renderer!.root.find(
      node => node.props.accessibilityLabel === 'Season 1',
    );
    const firstEpisodeButton = renderer!.root.find(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Episode 1,'),
    );
    ReactTestRenderer.act(() => firstEpisodeButton.props.onPress());

    expect(mockNavigate).toHaveBeenLastCalledWith('VideoPlayer', {
      request: expect.objectContaining({
        streamId: 'episode-1',
        resume: { progress: 600, totalDuration: 1800 },
      }),
    });
    mockNavigate.mockClear();

    ReactTestRenderer.act(() => seasonButton.props.onPress());

    const secondSeason = renderer!.root.find(
      node => node.props.accessibilityLabel === 'Season 2, 1 episodes',
    );
    await ReactTestRenderer.act(async () => secondSeason.props.onPress());

    const episodeList = getEpisodeList(renderer!.root);
    expect(episodeList.props.data).toHaveLength(1);
    expect(episodeList.props.data[0].title).toBe('Season Two Premiere');

    const episodeButton = renderer!.root.find(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Season Two Premiere'),
    );
    ReactTestRenderer.act(() => episodeButton.props.onPress());

    expect(mockNavigate).toHaveBeenCalledWith('VideoPlayer', {
      request: expect.objectContaining({
        kind: 'episode',
        streamId: 'season-2-episode-1',
        extension: 'mp4',
        seriesId: 'series-7',
        currentEpisodeIndex: 0,
        episodeList: mockSeriesDetailsQuery.data.episodes['2'],
      }),
    });

    ReactTestRenderer.act(() => renderer!.unmount());
  });
});
