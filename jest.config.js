module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:((jest-)?react-native|@react-native(?:-community)?|@react-navigation|react-redux|@reduxjs/toolkit|@tanstack|expo|@expo|expo-modules-core|expo-video|expo-libvlc-player|react-native-.+)))/',
  ],
};
