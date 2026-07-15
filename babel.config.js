module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    // NOTE: no react-native-dotenv here — its Babel transform perturbs Metro
    // module resolution and breaks react-native-worklets shared-value
    // serialization (see reanimated discussion #9023). TMDB env vars are
    // inlined by babel-preset-expo via EXPO_PUBLIC_* variables instead.
    // NOTE: no manual react-native-reanimated/plugin either — babel-preset-expo
    // auto-applies react-native-worklets/plugin.
  ],
};
