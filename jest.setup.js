/* eslint-env jest */

jest.mock('react-native-orientation-locker', () => ({
  lockToLandscape: jest.fn(),
  lockToPortrait: jest.fn(),
  unlockAllOrientations: jest.fn(),
}));
