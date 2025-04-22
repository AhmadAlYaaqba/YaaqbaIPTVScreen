import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import HomeScreenBrand from './HomeScreenBrand';
import LiveTVScreen from './LiveTVScreen';
import MoviesScreen from './singleMoviesScreen';
import SeriesHomeScreen from './SeriesList'

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({color, size}) => {
          const map = {
            Home: 'home',
            LiveTV: 'tv',
            Movies: 'photo-video',
            Favorites: 'heart',
            Settings: 'cog',
          };
          return (
            <FontAwesome5 name={map[route.name]} size={size} color={color} />
          );
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreenBrand} />
      <Tab.Screen name="LiveTV" component={LiveTVScreen} />
      <Tab.Screen name="Movies" component={MoviesScreen} />
      <Tab.Screen name="Series" component={SeriesHomeScreen} />
    </Tab.Navigator>
  );
}
