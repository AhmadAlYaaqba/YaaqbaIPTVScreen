// App.tsx
if (__DEV__) {
  require('./ReactotronConfig');
}

import React, {useEffect, useState} from 'react';
import {Platform, StyleSheet} from 'react-native';
import {Provider} from 'react-redux';
import {store} from './src/store';
import {NavigationContainer} from '@react-navigation/native';
import {QueryClientProvider} from '@tanstack/react-query';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Orientation from 'react-native-orientation-locker';

import RootNavigator from './RootNavigator';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import {IS_TABLET} from './src/utils/device';
import {queryClient} from './src/services/queryClient';
import {
  hydrateXtreamQueryCache,
  subscribeToXtreamQueryPersistence,
} from './src/services/xtream/xtreamPersistence';

const App = () => {
  const [isXtreamCacheReady, setIsXtreamCacheReady] = useState(false);

  // Portrait is the app-wide default on phones; only the video player locks to
  // landscape (and restores portrait on exit). Without this, the locker
  // defaults to "all orientations" and non-player screens could rotate freely.
  // TVs are always landscape, and iPads rotate freely, so neither is locked.
  useEffect(() => {
    if (!Platform.isTV && !IS_TABLET) {
      Orientation.lockToPortrait();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    hydrateXtreamQueryCache(queryClient).finally(() => {
      if (!mounted) {
        return;
      }
      unsubscribe = subscribeToXtreamQueryPersistence(queryClient);
      setIsXtreamCacheReady(true);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          {isXtreamCacheReady ? (
            <AppErrorBoundary>
              <SafeAreaProvider>
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
              </SafeAreaProvider>
            </AppErrorBoundary>
          ) : null}
        </QueryClientProvider>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
