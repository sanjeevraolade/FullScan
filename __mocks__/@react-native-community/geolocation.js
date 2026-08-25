/**
 * Manual Jest mock — @react-native-community/geolocation's native module
 * isn't registered under Jest's Node test environment (there's no on-device
 * runtime to host it). Auto-applied by Jest for every test since this file
 * lives in the root __mocks__ directory, matching the sibling mocks there.
 */
module.exports = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  requestAuthorization: jest.fn(),
  setRNConfiguration: jest.fn(),
};
