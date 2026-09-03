import type { MobileAppSettings, MobileAppSettingValue } from './reference-data.entity';

/**
 * Setting keys as stored in the backend's `mobile_app_settings` table.
 *
 * Named constants rather than string literals at call sites, so a renamed key
 * is one edit and a typo is a compile error.
 */
export const MOBILE_APP_SETTING_KEYS = {
  minSupportedAppVersion: 'min_supported_app_version',
  isForceUpdateEnabled: 'force_update_enabled',
  defaultLanguage: 'default_language',
  supportContactNumber: 'support_contact_number',
  isMaintenanceModeEnabled: 'maintenance_mode_enabled',
  maintenanceMessage: 'maintenance_message',
  isBiometricLoginEnabled: 'biometric_login_enabled',
  isMockLocationBlockEnabled: 'mock_location_block_enabled',
  sessionTimeoutMinutes: 'session_timeout_minutes',
  maxLoginAttempts: 'max_login_attempts',
  geoFenceRadiusMeters: 'geo_fence_radius_meters',
  photoCompressionQuality: 'photo_compression_quality',
  maxPhotoUploadSizeMb: 'max_photo_upload_size_mb',
  isWatermarkEnabled: 'watermark_enabled',
  syncIntervalMinutes: 'sync_interval_minutes',
  offlineQueueRetryLimit: 'offline_queue_retry_limit',
  isSyncOnWifiOnly: 'sync_on_wifi_only',
} as const;

/** Languages the app ships (see `src/localization`). */
export type MobileAppLanguage = 'en' | 'hi' | 'te';

const SUPPORTED_LANGUAGES: readonly MobileAppLanguage[] = ['en', 'hi', 'te'];

/** Every known setting, resolved to a usable value. */
export interface ResolvedMobileAppSettings {
  readonly minSupportedAppVersion: string;
  readonly isForceUpdateEnabled: boolean;
  readonly defaultLanguage: MobileAppLanguage;
  readonly supportContactNumber: string;
  readonly isMaintenanceModeEnabled: boolean;
  readonly maintenanceMessage: string;
  readonly isBiometricLoginEnabled: boolean;
  readonly isMockLocationBlockEnabled: boolean;
  readonly sessionTimeoutMinutes: number;
  readonly maxLoginAttempts: number;
  readonly geoFenceRadiusMeters: number;
  readonly photoCompressionQuality: number;
  readonly maxPhotoUploadSizeMb: number;
  readonly isWatermarkEnabled: boolean;
  readonly syncIntervalMinutes: number;
  readonly offlineQueueRetryLimit: number;
  readonly isSyncOnWifiOnly: boolean;
  /**
   * The raw payload, including any key the backend has that this build doesn't
   * yet know about. Prefer the typed fields above; reach in here only for a
   * setting added server-side after this release.
   */
  readonly values: Readonly<Record<string, MobileAppSettingValue>>;
  /** Most recent change across all settings, or null when config has never been edited. */
  readonly updatedAt: string | null;
}

/**
 * Values used before the first successful fetch, when a key is absent, or when a
 * value arrives in the wrong shape.
 *
 * These are not "empty" placeholders — they are the safe operating defaults, so
 * the app stays fully usable offline and on first run. Each mirrors the seeded
 * server-side default, with the security-relevant ones erring towards strict
 * (watermarking on, mock-location blocking on, maintenance mode off).
 */
export const DEFAULT_MOBILE_APP_SETTINGS: Omit<ResolvedMobileAppSettings, 'values' | 'updatedAt'> =
  {
    minSupportedAppVersion: '1.0.0',
    isForceUpdateEnabled: false,
    defaultLanguage: 'en',
    supportContactNumber: '',
    isMaintenanceModeEnabled: false,
    maintenanceMessage: '',
    isBiometricLoginEnabled: true,
    isMockLocationBlockEnabled: true,
    sessionTimeoutMinutes: 720,
    maxLoginAttempts: 5,
    geoFenceRadiusMeters: 200,
    photoCompressionQuality: 80,
    maxPhotoUploadSizeMb: 5,
    isWatermarkEnabled: true,
    syncIntervalMinutes: 15,
    offlineQueueRetryLimit: 5,
    isSyncOnWifiOnly: false,
  };

type SettingValues = Readonly<Record<string, MobileAppSettingValue>>;

/**
 * Reads a boolean setting. Accepts the string forms `'true'`/`'false'` too, so a
 * value that reaches the app as text (an older backend, a hand-edited row) is
 * still honoured instead of silently falling back.
 */
function readBooleanSetting(values: SettingValues, key: string, fallback: boolean): boolean {
  const value = values[key];

  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return fallback;
}

/** Reads a numeric setting, rejecting non-finite values and numeric-looking junk. */
function readNumberSetting(values: SettingValues, key: string, fallback: number): number {
  const value = values[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

/** Reads a string setting. An all-whitespace value counts as absent. */
function readStringSetting(values: SettingValues, key: string, fallback: string): string {
  const value = values[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Reads the default-language setting, ignoring any language this build can't render. */
function readLanguageSetting(
  values: SettingValues,
  key: string,
  fallback: MobileAppLanguage,
): MobileAppLanguage {
  const value = values[key];
  return SUPPORTED_LANGUAGES.find((language) => language === value) ?? fallback;
}

/**
 * Turns the raw settings payload into a fully typed object, substituting a safe
 * default for anything missing or malformed.
 *
 * Pass `null` before the first fetch (or offline on a cold start) to get the
 * defaults — callers never have to null-check individual settings.
 */
export function resolveMobileAppSettings(
  settings: MobileAppSettings | null | undefined,
): ResolvedMobileAppSettings {
  const values: SettingValues = settings?.values ?? {};
  const keys = MOBILE_APP_SETTING_KEYS;
  const defaults = DEFAULT_MOBILE_APP_SETTINGS;

  return {
    minSupportedAppVersion: readStringSetting(
      values,
      keys.minSupportedAppVersion,
      defaults.minSupportedAppVersion,
    ),
    isForceUpdateEnabled: readBooleanSetting(
      values,
      keys.isForceUpdateEnabled,
      defaults.isForceUpdateEnabled,
    ),
    defaultLanguage: readLanguageSetting(values, keys.defaultLanguage, defaults.defaultLanguage),
    supportContactNumber: readStringSetting(
      values,
      keys.supportContactNumber,
      defaults.supportContactNumber,
    ),
    isMaintenanceModeEnabled: readBooleanSetting(
      values,
      keys.isMaintenanceModeEnabled,
      defaults.isMaintenanceModeEnabled,
    ),
    maintenanceMessage: readStringSetting(
      values,
      keys.maintenanceMessage,
      defaults.maintenanceMessage,
    ),
    isBiometricLoginEnabled: readBooleanSetting(
      values,
      keys.isBiometricLoginEnabled,
      defaults.isBiometricLoginEnabled,
    ),
    isMockLocationBlockEnabled: readBooleanSetting(
      values,
      keys.isMockLocationBlockEnabled,
      defaults.isMockLocationBlockEnabled,
    ),
    sessionTimeoutMinutes: readNumberSetting(
      values,
      keys.sessionTimeoutMinutes,
      defaults.sessionTimeoutMinutes,
    ),
    maxLoginAttempts: readNumberSetting(values, keys.maxLoginAttempts, defaults.maxLoginAttempts),
    geoFenceRadiusMeters: readNumberSetting(
      values,
      keys.geoFenceRadiusMeters,
      defaults.geoFenceRadiusMeters,
    ),
    photoCompressionQuality: readNumberSetting(
      values,
      keys.photoCompressionQuality,
      defaults.photoCompressionQuality,
    ),
    maxPhotoUploadSizeMb: readNumberSetting(
      values,
      keys.maxPhotoUploadSizeMb,
      defaults.maxPhotoUploadSizeMb,
    ),
    isWatermarkEnabled: readBooleanSetting(
      values,
      keys.isWatermarkEnabled,
      defaults.isWatermarkEnabled,
    ),
    syncIntervalMinutes: readNumberSetting(
      values,
      keys.syncIntervalMinutes,
      defaults.syncIntervalMinutes,
    ),
    offlineQueueRetryLimit: readNumberSetting(
      values,
      keys.offlineQueueRetryLimit,
      defaults.offlineQueueRetryLimit,
    ),
    isSyncOnWifiOnly: readBooleanSetting(values, keys.isSyncOnWifiOnly, defaults.isSyncOnWifiOnly),
    values,
    updatedAt: settings?.updatedAt ?? null,
  };
}
