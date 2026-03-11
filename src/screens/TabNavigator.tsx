import React from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  StyleSheet,
  Platform,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';

import HomeScreenBrand from './HomeScreenBrand';
import LiveTVScreen from './LiveTVScreen';
import MoviesScreen from './singleMoviesScreen';
import SeriesHomeScreen from './SeriesList';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

const ACTIVE_COLOR = '#4A90E2';
const INACTIVE_COLOR = 'rgba(160, 175, 200, 0.65)';

const TAB_LABELS: Record<string, string> = {
  Home: 'Home',
  LiveTV: 'Live TV',
  Movies: 'Movies',
  Series: 'Series',
  Settings: 'Settings',
};

function getIcon(name: string, color: string, size: number) {
  switch (name) {
    case 'Home':
      return <Ionicons name="home" size={size} color={color} />;
    case 'LiveTV':
      return <MaterialIcons name="live-tv" size={size} color={color} />;
    case 'Movies':
      return <MaterialCommunityIcons name="movie-open" size={size} color={color} />;
    case 'Series':
      return <MaterialCommunityIcons name="movie-roll" size={size} color={color} />;
    case 'Settings':
      return <Ionicons name="settings-sharp" size={size} color={color} />;
    default:
      return <Ionicons name="ellipse" size={size} color={color} />;
  }
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBarOuter}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="dark"
        blurAmount={20}
        reducedTransparencyFallbackColor="rgba(10, 14, 30, 0.92)"
      />
      <View style={styles.tintOverlay} />

      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;
          const label = TAB_LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.7}
              onPress={onPress}
              style={styles.tabItem}
            >
              {getIcon(route.name, color, 22)}
              <Text style={[styles.tabLabel, { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreenBrand} />
      <Tab.Screen name="LiveTV" component={LiveTVScreen} />
      <Tab.Screen name="Movies" component={MoviesScreen} />
      <Tab.Screen name="Series" component={SeriesHomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 18,
    left: 25,
    right: 25,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    // Subtle glass border
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    // Floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 30, 0.45)',
  },
  tabBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
