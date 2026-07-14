// App.tsx
import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useDispatch } from 'react-redux';
import { AppDispatch } from './src/store';

import LoginScreen from './src/screens/LoginScreen4';
import HomeScreen from './src/screens/HomeScreen';
import LiveScreen from './src/screens/LiveScreen';
import MoviesScreen from './src/screens/MoviesScreen';
import MovieListScreen from './src/screens/MovieListScreen';
import MovieDetailScreen from './src/screens/MovieDetailScreen';
import SeriesScreen from './src/screens/SeriesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LiveChannelsScreen from './src/screens/LiveChannelsScreen';

import SeriesCategoriesScreen from './src/screens/SeriesCategoriesScreen';
import SeriesListScreen from './src/screens/SeriesListScreen';
import SeriesDetailScreen from './src/screens/SeriesDetailScreen';
import VideoPlayerScreen from './src/screens/VideoPlayerScreen';
import TabNavigator from "./src/screens/TabNavigator";

import { applyPlaylistToSession } from './src/services/playlists/usePlaylists';
import {
  getPlaylistStore,
  getActivePlaylist,
  migrateLegacyCredentials,
} from './src/services/playlists/playlistStore';

export type RootStackParamList = {
  Login: { initialTab?: 'activation' | 'xtream'; mode?: 'add' } | undefined;
  Main: undefined;
  Home: undefined;
  Live: undefined;
  LiveTV: undefined;
  Movies: undefined;
  Series: undefined;
  Settings: undefined;
  LiveChannels: { categoryId: string; categoryName: string };
  VideoPlayer: {
    streamUrl: string;
    channelName?: string;
    isLive?: boolean;
    title?: string;
    seriesId?: string;
    episodeId?: string;
    episodeList?: any[];
    currentEpisodeIndex?: number;
    movieId?: string;
    continueTime?: { progress: number; totalDuration?: number } | null;
    thumbnail?: string;
    categoryId?: string;
  };
  MovieList: { categoryId: string; categoryName: string };
  MovieDetail: { movie: any };
  SeriesCategories: undefined;
  SeriesList: { categoryId: string; categoryName: string };
  SeriesDetail: { seriesId: string; seriesName: string; baseInfo?: any };
};

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // One-time migration of the pre-multi-playlist single-blob credentials.
        await migrateLegacyCredentials();

        const active = await getActivePlaylist();
        if (active) {
          const store = await getPlaylistStore();
          applyPlaylistToSession(active, store.playerEngine, dispatch);
        } else if (__DEV__) {
          console.log('No active playlist to restore');
        }
      } catch (error) {
        if (__DEV__) console.log('Session restore error: ', error);
      }
    };

    restoreSession();
  }, [dispatch]);

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Live" component={LiveScreen} />
      <Stack.Screen name="Movies" component={MoviesScreen} />
      <Stack.Screen name="MovieList" component={MovieListScreen} />
      <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
      {/* <Stack.Screen name="Series" component={SeriesScreen} /> */}
      <Stack.Screen name="LiveChannels" component={LiveChannelsScreen} />
      <Stack.Screen name="Series" component={SeriesCategoriesScreen} />
      <Stack.Screen name="SeriesList" component={SeriesListScreen} />
      <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} />
      <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
