/**
 * Manual Jest mock — react-native-device-info's native module isn't
 * registered under Jest's Node test environment (there's no on-device
 * runtime to host it). Auto-applied by Jest for every test since this file
 * lives in the root __mocks__ directory, matching the react-native-bootsplash
 * mock alongside it.
 */
module.exports = {
  getVersion: jest.fn(() => '1.0.0'),
  // Tests describe real hardware by default; the simulator cases opt in.
  isEmulatorSync: jest.fn(() => false),
};
