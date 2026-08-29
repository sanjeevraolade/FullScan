import * as Keychain from 'react-native-keychain';

import { LoggerService } from '@/infrastructure/logger';

import type { ITokenStorage } from './token-storage.interface';

const FILE_NAME = 'token-storage.service.ts';

/**
 * Keychain/Keystore entries are keyed by `service` + `username`; the auth
 * token isn't tied to a real account name, so a fixed placeholder username is
 * used to address the single stored entry.
 */
const KEYCHAIN_SERVICE = 'com.fullscan.auth.token';
const KEYCHAIN_USERNAME = 'authToken';

async function saveToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, token, { service: KEYCHAIN_SERVICE });
  LoggerService.info(`${FILE_NAME}: saveToken: token persisted to secure storage`);
}

async function getToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  return credentials ? credentials.password : null;
}

async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  LoggerService.info(`${FILE_NAME}: clearToken: token removed from secure storage`);
}

/**
 * Auth token persistence — backed by the platform Keychain/Keystore, never
 * MMKV or AsyncStorage, since the token is a bearer credential.
 */
export const TokenStorageService: ITokenStorage = { saveToken, getToken, clearToken };
