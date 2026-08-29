/**
 * Manual Jest mock — react-native-keychain's native module isn't registered
 * under Jest's Node test environment (there's no on-device Keychain/Keystore
 * to host it). Auto-applied by Jest for every test since this file lives in
 * the root __mocks__ directory, matching the sibling mocks there.
 */
module.exports = {
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
  STORAGE_TYPE: { AES_GCM: 'KeystoreAESGCM' },
};
