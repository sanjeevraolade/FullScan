/**
 * Manual Jest mock — react-native-bootsplash's native TurboModule isn't
 * registered under Jest's Node test environment (there's no on-device
 * runtime to host it). Auto-applied by Jest for every test since this file
 * lives in the root __mocks__ directory.
 */
module.exports = {
  hide: jest.fn(() => Promise.resolve()),
  isVisible: jest.fn(() => false),
};
