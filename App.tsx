// App.tsx
if (__DEV__) {
  require('./ReactotronConfig');
}

import React, {useEffect} from 'react';
import {Provider} from 'react-redux';
import {store} from './src/store';
import {NavigationContainer} from '@react-navigation/native';
import {QueryClientProvider} from '@tanstack/react-query';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Orientation from 'react-native-orientation-locker';

import RootNavigator from './RootNavigator';
import {queryClient} from './src/services/queryClient';

const App = () => {
  // Portrait is the app-wide default; only the video player locks to landscape
  // (and restores portrait on exit). Without this, the locker defaults to
  // "all orientations" and non-player screens could rotate freely.
  useEffect(() => {
    Orientation.lockToPortrait();
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
