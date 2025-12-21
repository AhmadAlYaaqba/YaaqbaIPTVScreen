import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import HomeScreenBrand from './HomeScreenBrand';
import LiveTVScreen from './LiveTVScreen';
import MoviesScreen from './singleMoviesScreen';
import SeriesHomeScreen from './SeriesList';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({color, size}) => {
          const iconMap: Record<string, string> = {
            Home: 'home',
            LiveTV: 'tv',
            Movies: 'photo-video',
            Favorites: 'heart',
            Settings: 'cog',
            Series: 'tv',
          };
          if (route.name === 'LiveTV') {
            return <MaterialIcons name="live-tv" size={size} color={color} />;
          }
          return (
            <FontAwesome5 name={iconMap[route.name]} size={size} color={color} />
          );
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreenBrand} />
      <Tab.Screen name="LiveTV" component={LiveTVScreen} />
      <Tab.Screen name="Movies" component={MoviesScreen} />
      <Tab.Screen name="Series" component={SeriesHomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
