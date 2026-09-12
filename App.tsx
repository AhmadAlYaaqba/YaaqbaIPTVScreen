// App.tsx
if (__DEV__) {
  require('./ReactotronConfig');
}

import React, {useEffect, useState} from 'react';
import {Provider} from 'react-redux';
import {store} from './src/store';
import {NavigationContainer} from '@react-navigation/native';
import {QueryClientProvider} from '@tanstack/react-query';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Orientation from 'react-native-orientation-locker';

import RootNavigator from './RootNavigator';
import {queryClient} from './src/services/queryClient';
import {
  hydrateXtreamQueryCache,
  subscribeToXtreamQueryPersistence,
} from './src/services/xtream/xtreamPersistence';

const App = () => {
  const [isXtreamCacheReady, setIsXtreamCacheReady] = useState(false);

  // Portrait is the app-wide default; only the video player locks to landscape
  // (and restores portrait on exit). Without this, the locker defaults to
  // "all orientations" and non-player screens could rotate freely.
  useEffect(() => {
    Orientation.lockToPortrait();
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
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {isXtreamCacheReady ? (
          <SafeAreaProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        ) : null}
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
