import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useDispatch } from 'react-redux';
import { AppDispatch } from './src/store';
import type { RootStackParamList } from './src/navigation/types';

import LoginScreen from './src/screens/LoginScreen4';
import SeriesDetailScreen from './src/screens/SeriesDetailScreen';
import VideoPlayerScreen from './src/screens/VideoPlayerScreen';
import TabNavigator from './src/screens/TabNavigator';

import { applyPlaylistToSession } from './src/services/playlists/usePlaylists';
import {
  getPlaylistStore,
  getActivePlaylist,
  migrateLegacyCredentials,
} from './src/services/playlists/playlistStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
          await applyPlaylistToSession(active, store.playerEngine, dispatch);
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
      <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} />
      <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
