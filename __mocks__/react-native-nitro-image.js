/**
 * Manual Jest mock — react-native-nitro-image creates native HybridObject
 * proxies (via react-native-nitro-modules) as a top-level side effect of
 * importing the package, which throws under Jest's Node environment (no
 * on-device TurboModule host). Auto-applied for every test since this file
 * lives in the root __mocks__ directory.
 */
module.exports = {
  Images: {
    loadFromFileAsync: jest.fn(),
    loadFromFile: jest.fn(),
  },
  NitroImage: () => null,
  useImage: jest.fn(),
  useImageLoader: jest.fn(),
};
