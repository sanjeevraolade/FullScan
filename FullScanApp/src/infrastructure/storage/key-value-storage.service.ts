import { createMMKV } from 'react-native-mmkv';

import { LoggerService } from '@/infrastructure/logger';

import type { IKeyValueStorage } from './key-value-storage.interface';

const FILE_NAME = 'key-value-storage.service.ts';

/**
 * One named instance for the whole app, so cached data survives a reinstall of
 * nothing and can be inspected/cleared as a unit.
 */
const storage = createMMKV({ id: 'fullscan.cache' });

/**
 * Keys are NOT safe to log verbatim: the geocoding cache builds its key from the
 * candidate's normalized address (`GeocodingService.toCacheKey`), so logging the
 * raw key would put a candidate address in the console and in any crash report
 * that captures it. Everything up to the first `:` is a fixed namespace and
 * carries all the diagnostic value; the rest is reduced to a length.
 */
function toLoggableKey(key: string): Readonly<Record<string, unknown>> {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex === -1) {
    return { keyNamespace: key };
  }

  return {
    keyNamespace: key.slice(0, separatorIndex),
    keyDetailLength: key.length - separatorIndex - 1,
  };
}

function getString(key: string): string | null {
  const value = storage.getString(key);
  LoggerService.info(`${FILE_NAME}: getString: read`, {
    ...toLoggableKey(key),
    hasValue: value !== undefined,
  });
  return value ?? null;
}

function setString(key: string, value: string): void {
  LoggerService.info(`${FILE_NAME}: setString: write`, toLoggableKey(key));
  storage.set(key, value);
}

function getObject<TValue>(key: string): TValue | null {
  const raw = storage.getString(key);
  if (raw === undefined) {
    LoggerService.info(`${FILE_NAME}: getObject: miss`, toLoggableKey(key));
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TValue;
    // Never log the stored value — cached entries can hold candidate PII.
    LoggerService.info(`${FILE_NAME}: getObject: hit`, { hasValue: true });
    return parsed;
  } catch (error: unknown) {
    // A corrupt entry is dropped rather than surfaced — the caller's
    // fallback path (re-fetch, re-geocode) is always safe.
    LoggerService.error(`${FILE_NAME}: getObject: corrupt entry discarded`, {
      ...toLoggableKey(key),
      message: error instanceof Error ? error.message : String(error),
    });
    storage.remove(key);
    return null;
  }
}

function setObject(key: string, value: unknown): void {
  LoggerService.info(`${FILE_NAME}: setObject: write`, toLoggableKey(key));
  storage.set(key, JSON.stringify(value));
}

function remove(key: string): void {
  LoggerService.info(`${FILE_NAME}: remove: delete`, toLoggableKey(key));
  storage.remove(key);
}

function getAllKeys(): readonly string[] {
  const keys = storage.getAllKeys();
  LoggerService.info(`${FILE_NAME}: getAllKeys: listing keys`, { count: keys.length });
  return keys;
}

export const KeyValueStorageService: IKeyValueStorage = {
  getString,
  setString,
  getObject,
  setObject,
  remove,
  getAllKeys,
};
