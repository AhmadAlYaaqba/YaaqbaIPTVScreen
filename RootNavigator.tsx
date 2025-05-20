// App.tsx
import React, {useEffect} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import * as Keychain from 'react-native-keychain';

import {useDispatch} from 'react-redux';
import {AppDispatch} from './src/store';

import LoginScreen from './src/screens/LoginScreen3';
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

import {setUserCredentials} from './src/store/slices/userSlice';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Live: undefined;
  Movies: undefined;
  Series: undefined;
  Settings: undefined;
  LiveChannels: {categoryId: string; categoryName: string};
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
    continueTime?: string | number;
  };
  MovieList: {categoryId: string; categoryName: string};
  MovieDetail: {movie: any};
  SeriesCategories: undefined;
  SeriesList: {categoryId: string; categoryName: string};
  SeriesDetail: {seriesId: string; seriesName: string};
};

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const restoreCredentials = async () => {
      try {
        // Attempt to load credentials from Keychain
        const creds = await Keychain.getGenericPassword({
          service: 'my-iptv-credentials',
        });
        if (creds) {
          const parsed = JSON.parse(creds.password);
          // If found, dispatch to Redux to sync user credentials
          // (Adjust if you also store domain/port in Keychain)
          dispatch(
            setUserCredentials({
              ...parsed,
              // domain and port if stored or in Redux
              // e.g. serverDomain, serverPort
            }),
          );
        } else {
          // No credentials found
          console.log('No saved credentials in Keychain');
        }
      } catch (error) {
        console.log('Keychain error: ', error);
      } finally {
        // setCheckingKeychain(false);
      }
    };

    restoreCredentials();
  });

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{headerShown: false}}>
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
