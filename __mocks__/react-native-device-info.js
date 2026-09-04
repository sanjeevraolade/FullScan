/**
 * Manual Jest mock — react-native-device-info's native module isn't
 * registered under Jest's Node test environment (there's no on-device
 * runtime to host it). Auto-applied by Jest for every test since this file
 * lives in the root __mocks__ directory, matching the react-native-bootsplash
 * mock alongside it.
 */
module.exports = {
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '100'),
  getUniqueId: jest.fn(async () => 'test-unique-id'),
  getDeviceName: jest.fn(async () => 'Test Device'),
  getModel: jest.fn(() => 'test-model'),
  getBrand: jest.fn(() => 'test-brand'),
  getManufacturer: jest.fn(async () => 'test-manufacturer'),
  getDeviceType: jest.fn(() => 'Handset'),
  getSystemName: jest.fn(() => 'Android'),
  getSystemVersion: jest.fn(() => '14.0'),
  getInstallerPackageName: jest.fn(async () => 'com.android.vending'),
  isEmulator: jest.fn(async () => false),
  // Tests describe real hardware by default; the simulator cases opt in.
  isEmulatorSync: jest.fn(() => false),
};
