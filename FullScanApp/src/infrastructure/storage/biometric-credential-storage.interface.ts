import type { BiometricCredentials } from './biometric-credential-storage.types';

export interface IBiometricCredentialStorage {
  /**
   * Overwrites any existing entry. iOS writes silently; Android's biometric
   * Keystore key also gates encryption, so the write may raise the OS prompt —
   * `promptMessage` titles it when it does.
   */
  save(credentials: BiometricCredentials, promptMessage?: string): Promise<void>;
  /** Triggers the OS Face ID/fingerprint prompt; resolves null on failure, cancellation, or no stored entry. */
  retrieve(promptMessage: string): Promise<BiometricCredentials | null>;
  clear(): Promise<void>;
  /** Existence check only — never triggers the biometric prompt. */
  exists(): Promise<boolean>;
}
