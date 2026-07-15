module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
    // NOTE: no manual react-native-reanimated/plugin here — babel-preset-expo
    // auto-applies react-native-worklets/plugin (which reanimated 4's plugin
    // aliases); listing it again double-workletizes and crashes at runtime
    // ("undefined is not a function" in withTiming/useAnimatedStyle).
  ],
};
