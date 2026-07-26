module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // react-stately/react-aria (a Gluestack UI dependency) ship static class
    // block syntax; Metro's default RN preset doesn't include this plugin.
    '@babel/plugin-transform-class-static-block',
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.jsx', '.js', '.json'],
        alias: {
          '@': './src',
        },
      },
    ],
  ],
};
