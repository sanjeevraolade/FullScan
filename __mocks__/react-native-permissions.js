/**
 * Manual Jest mock — react-native-permissions' native module isn't
 * registered under Jest's Node test environment (there's no on-device
 * runtime to host it). Auto-applied by Jest for every test since this file
 * lives in the root __mocks__ directory, matching the sibling mocks there.
 */
module.exports = {
  PERMISSIONS: {
    IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE' },
    ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    BLOCKED: 'blocked',
    DENIED: 'denied',
    GRANTED: 'granted',
    LIMITED: 'limited',
  },
  check: jest.fn(),
  request: jest.fn(),
  openSettings: jest.fn(() => Promise.resolve()),
};
