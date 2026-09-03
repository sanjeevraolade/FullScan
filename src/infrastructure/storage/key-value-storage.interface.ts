/**
 * Non-sensitive, synchronous device storage (MMKV). Secrets — tokens,
 * credentials, biometric material — never come here; they belong in
 * `TokenStorageService` / `BiometricCredentialStorageService`, which are
 * Keychain/Keystore-backed.
 */
export interface IKeyValueStorage {
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  /** Reads and JSON-parses a value, returning `null` for missing or corrupt entries. */
  getObject<TValue>(key: string): TValue | null;
  setObject(key: string, value: unknown): void;
  remove(key: string): void;
  /** Every key currently stored, for prefix-scoped cleanup. */
  getAllKeys(): readonly string[];
}
