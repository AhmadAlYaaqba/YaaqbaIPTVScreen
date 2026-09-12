/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../ReactotronConfig', () => ({}));
jest.mock('../RootNavigator', () => {
  const ReactNative = require('react-native');

  return {
    __esModule: true,
    default: function MockRootNavigator() {
      return <ReactNative.View testID="root-navigator" />;
    },
  };
});
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
}));

const App = require('../App').default;

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer!.root.findByProps({testID: 'root-navigator'})).toBeTruthy();

  ReactTestRenderer.act(() => renderer!.unmount());
});
