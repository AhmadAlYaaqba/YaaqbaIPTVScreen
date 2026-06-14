// App.tsx
if (__DEV__) {
  require('./ReactotronConfig');
}

import React from 'react';
import {Provider} from 'react-redux';
import {store} from './src/store';
import {NavigationContainer} from '@react-navigation/native';
import {QueryClientProvider} from '@tanstack/react-query';

import RootNavigator from './RootNavigator';
import {queryClient} from './src/services/queryClient';

const App = () => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
