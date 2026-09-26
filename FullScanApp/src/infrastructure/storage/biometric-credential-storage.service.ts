import * as Keychain from 'react-native-keychain';

import { LoggerService } from '@/infrastructure/logger';

import type { IBiometricCredentialStorage } from './biometric-credential-storage.interface';
import type { BiometricCredentials } from './biometric-credential-storage.types';

const FILE_NAME = 'biometric-credential-storage.service.ts';

/**
 * Separate Keychain service from `TokenStorageService` on purpose: this
 * entry is written with a biometric access control, so reading it always
 * triggers the OS Face ID/fingerprint prompt. The plain bearer token used by
 * every API call must never be gated behind that prompt.
 */
const KEYCHAIN_SERVICE = 'com.fullscan.auth.biometric';

async function save(credentials: BiometricCredentials): Promise<void> {
  // Never log the username, the password, or their lengths.
  LoggerService.info(`${FILE_NAME}: save: persisting biometric credentials to secure storage`);
  await Keychain.setGenericPassword(credentials.username, credentials.password, {
    service: KEYCHAIN_SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  LoggerService.info(`${FILE_NAME}: save: biometric credentials persisted to secure storage`);
}

/**
 * An earlier build wrote this field as `JSON.stringify({ password, token })`
 * instead of the plain password. Detects a leftover entry in that shape so
 * it can be discarded instead of handed to `/auth/login` as-is.
 */
function isLegacyEncodedSecret(password: string): boolean {
  // Only the shape verdict is logged — never the secret being inspected.
  LoggerService.info(`${FILE_NAME}: isLegacyEncodedSecret: inspecting stored secret shape`);
  try {
    const parsed: unknown = JSON.parse(password);
    const isLegacyShape = typeof parsed === 'object' && parsed !== null && 'password' in parsed;
    LoggerService.info(`${FILE_NAME}: isLegacyEncodedSecret: secret shape resolved`, {
      isLegacyShape,
    });
    return isLegacyShape;
  } catch {
    LoggerService.info(`${FILE_NAME}: isLegacyEncodedSecret: secret is not json, not legacy`);
    return false;
  }
}

async function retrieve(promptMessage: string): Promise<BiometricCredentials | null> {
  LoggerService.info(`${FILE_NAME}: retrieve: prompting for biometric verification`);
  try {
    const storedCredentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
      authenticationPrompt: { title: promptMessage },
    });
    if (!storedCredentials) {
      LoggerService.warn(`${FILE_NAME}: retrieve: no biometric credentials stored`);
      return null;
    }
    if (isLegacyEncodedSecret(storedCredentials.password)) {
      LoggerService.warn(`${FILE_NAME}: retrieve: discarding legacy-format vault entry`);
      await clear();
      return null;
    }
    LoggerService.info(`${FILE_NAME}: retrieve: biometric credentials verified and retrieved`);
    return { username: storedCredentials.username, password: storedCredentials.password };
  } catch (error: unknown) {
    LoggerService.warn(`${FILE_NAME}: retrieve: biometric verification failed or was cancelled`);
    return null;
  }
}

async function clear(): Promise<void> {
  LoggerService.info(`${FILE_NAME}: clear: removing biometric credentials from secure storage`);
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  LoggerService.info(`${FILE_NAME}: clear: biometric credentials removed from secure storage`);
}

async function exists(): Promise<boolean> {
  LoggerService.info(`${FILE_NAME}: exists: checking for stored biometric credentials`);
  const hasStoredCredentials = await Keychain.hasGenericPassword({ service: KEYCHAIN_SERVICE });
  LoggerService.info(`${FILE_NAME}: exists: stored biometric credential check complete`, {
    hasStoredCredentials,
  });
  return hasStoredCredentials;
}

/**
 * Biometric-gated credential vault — holds the username, password and last
 * known token behind a Face ID/fingerprint prompt so a returning user can
 * restore their session without retyping credentials. Never mirrors
 * `TokenStorageService`, which stays ungated for use on every API call.
 */
export const BiometricCredentialStorageService: IBiometricCredentialStorage = {
  save,
  retrieve,
  clear,
  exists,
};
