/* eslint-env jest */

jest.mock('react-native-orientation-locker', () => ({
  lockToLandscape: jest.fn(),
  lockToPortrait: jest.fn(),
  unlockAllOrientations: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
