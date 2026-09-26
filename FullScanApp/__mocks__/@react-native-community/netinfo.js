/**
 * Manual Jest mock — @react-native-community/netinfo's native module isn't
 * registered under Jest's Node test environment. Defaults to "online" so a
 * test that doesn't care about connectivity takes the normal path; override
 * per test with `jest.mocked(NetInfo.fetch).mockResolvedValue(...)`.
 * Auto-applied for every test since this file lives in the root __mocks__
 * directory, matching the sibling geolocation mock.
 */
module.exports = {
  __esModule: true,
  default: {
    fetch: jest.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
    ),
    addEventListener: jest.fn(() => jest.fn()),
  },
};
