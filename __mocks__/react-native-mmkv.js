/**
 * Manual Jest mock — react-native-mmkv is a Nitro-backed native module with no
 * host in Jest's Node environment. This stands in with an in-memory Map that
 * behaves like MMKV's synchronous API, so cache-hit/cache-miss paths are
 * genuinely exercised in tests. Auto-applied for every test since this file
 * lives in the root __mocks__ directory, matching the sibling mocks there.
 */
function createMMKV() {
  const store = new Map();
  return {
    set: (key, value) => {
      store.set(key, value);
    },
    getString: (key) => (store.has(key) ? store.get(key) : undefined),
    remove: (key) => store.delete(key),
    contains: (key) => store.has(key),
    getAllKeys: () => [...store.keys()],
    clearAll: () => {
      store.clear();
    },
  };
}

module.exports = { createMMKV };
