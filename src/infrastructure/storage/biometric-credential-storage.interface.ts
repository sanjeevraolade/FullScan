import type { BiometricCredentials } from './biometric-credential-storage.types';

export interface IBiometricCredentialStorage {
  save(credentials: BiometricCredentials): Promise<void>;
  /** Triggers the OS Face ID/fingerprint prompt; resolves null on failure, cancellation, or no stored entry. */
  retrieve(promptMessage: string): Promise<BiometricCredentials | null>;
  clear(): Promise<void>;
  /** Existence check only — never triggers the biometric prompt. */
  exists(): Promise<boolean>;
}
