import React from 'react';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { StyleSheet, Platform, View, Text, Pressable } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreenBrand from './HomeScreenBrand';
import LiveTVScreen from './LiveTVScreen';
import MoviesScreen from './singleMoviesScreen';
import SeriesHomeScreen from './SeriesList';
import SettingsScreen from './SettingsScreen';
import TVNavRail from '../tv/TVNavRail';
import AppIcon, { type AppIconName } from '../components/AppIcon';
import type { TabParamList } from '../navigation/types';

const Tab = createBottomTabNavigator<TabParamList>();

const ACTIVE_COLOR = '#8b7bff';
const INACTIVE_COLOR = '#7b829a';

const TAB_LABELS: Record<keyof TabParamList, string> = {
  Home: 'Home',
  LiveTV: 'Live TV',
  Movies: 'Movies',
  Series: 'Series',
  Settings: 'Settings',
};

const TAB_ICONS: Record<keyof TabParamList, AppIconName> = {
  Home: 'home',
  LiveTV: 'broadcast-tower',
  Movies: 'film',
  Series: 'tv',
  Settings: 'cog',
};

function getIcon(name: keyof TabParamList, color: string, size: number) {
  return (
    <AppIcon
      name={TAB_ICONS[name] ?? 'circle'}
      size={name === 'Home' ? size - 1 : size}
      color={color}
    />
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Float above the system gesture/nav bar. Fall back to the platform default
  // on devices that report no bottom inset (e.g. Android hardware buttons).
  const bottomOffset =
    insets.bottom > 0 ? insets.bottom + 6 : Platform.OS === 'ios' ? 30 : 18;

  return (
    <View style={[styles.tabBarOuter, { bottom: bottomOffset }]}>
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
          const routeName = route.name as keyof TabParamList;
          const label = TAB_LABELS[routeName];

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
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isFocused }}>
              {getIcon(routeName, color, 22)}
              <Text style={[styles.tabLabel, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getTabLabel = (routeName: string) =>
  TAB_LABELS[routeName as keyof TabParamList] ?? routeName;
const renderTabIcon = (routeName: string, color: string, size: number) =>
  getIcon(routeName as keyof TabParamList, color, size);

// TV gets a left focus rail; phones keep the floating bottom bar.
const renderTabBar = (props: BottomTabBarProps) =>
  Platform.isTV ? (
    <TVNavRail {...props} getLabel={getTabLabel} renderIcon={renderTabIcon} />
  ) : (
    <CustomTabBar {...props} />
  );

const SCREEN_OPTIONS = {
  headerShown: false,
  tabBarPosition: Platform.isTV ? 'left' : 'bottom',
} as const;

export default function TabNavigator() {
  return (
    <Tab.Navigator tabBar={renderTabBar} screenOptions={SCREEN_OPTIONS}>
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
    // `bottom` is set dynamically from safe-area insets in CustomTabBar.
    left: 25,
    right: 25,
    height: 68,
    borderRadius: 24,
    overflow: 'hidden',
    // Subtle glass border
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    // Floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 20, 40, 0.72)',
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
    minHeight: 48,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
