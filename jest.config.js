module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:((jest-)?react-native|@react-native(?:-community)?|@react-navigation|react-redux|@reduxjs/toolkit|@tanstack|expo|@expo|expo-modules-core|expo-video|expo-libvlc-player|react-native-.+)))/',
  ],
};
