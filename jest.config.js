module.exports = {
  preset: '@react-native/jest-preset',
  // Documented React Navigation setup: the Drawer navigator's gesture layer
  // needs react-native-gesture-handler's native module mocked under Jest.
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  moduleNameMapper: {
    // The Drawer navigator's gesture layer pulls in react-native-reanimated
    // (and its react-native-worklets peer), whose native modules aren't
    // available under Jest — their own mocks stand in, per each library's
    // documented Jest setup.
    '^react-native-reanimated$': 'react-native-reanimated/mock',
    '^react-native-worklets$': 'react-native-worklets/lib/module/mock',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      '@react-native/jest-preset/jest/assetFileTransformer.js',
    ),
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-gesture-handler|react-native-drawer-layout|react-native-reanimated|react-native-worklets|@gluestack-ui|@gluestack-style|@legendapp|@expo|i18next|react-i18next)/)',
  ],
};
