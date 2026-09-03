import { LoggerService } from '@/infrastructure/logger';

import type { MobileAppSettings, MobileAppSettingValue } from './reference-data.entity';

const FILE_NAME = 'mobile-app-settings.ts';

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
  /** Retry parameter — camelCase on the wire, as the mobile contract specifies. */
  locationRetryCount: 'locationRetryCount',
  /** Which `IGeocodingProvider` resolves an address to coordinates. */
  geocodingProvider: 'geocoding_provider',
  /** Which routing provider `DirectionsDistanceService` calls. */
  directionsProvider: 'directions_provider',
  /**
   * Whether route/travel distance may be fetched at all. Off by default: it
   * costs money per request and geo-fencing never needs it.
   */
  isDirectionsDistanceEnabled: 'directions_distance_enabled',
  /** Key for the configured maps provider. Never logged, never persisted by the app. */
  mapsApiKey: 'maps_api_key',
  /** Geocoding endpoint override, so a proxy can be swapped in server-side. */
  mapsApiBaseUrl: 'maps_api_base_url',
  /** Directions endpoint override, independent of the geocoding one. */
  directionsApiBaseUrl: 'directions_api_base_url',
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

/**
 * Accepted range for each numeric setting, mirroring the `min_value`/`max_value`
 * the backend enforces when an admin saves.
 *
 * Duplicated here on purpose: the mobile payload deliberately carries only
 * values (not the portal's min/max metadata), so the app cannot learn the bounds
 * at runtime. A value outside its range is treated like any other malformed
 * value — that one setting falls back to its default — which keeps a bad
 * configuration from disabling geo-fencing or wedging the retry loop.
 */
export const MOBILE_APP_SETTING_RANGES = {
  sessionTimeoutMinutes: { min: 5, max: 10080 },
  maxLoginAttempts: { min: 1, max: 20 },
  geoFenceRadiusMeters: { min: 10, max: 2000 },
  locationRetryCount: { min: 3, max: 10 },
  photoCompressionQuality: { min: 1, max: 100 },
  maxPhotoUploadSizeMb: { min: 1, max: 50 },
  syncIntervalMinutes: { min: 1, max: 1440 },
  offlineQueueRetryLimit: { min: 1, max: 25 },
} as const;

interface NumericRange {
  readonly min: number;
  readonly max: number;
}

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
  /** GPS fix re-attempts before a capture is abandoned (3-10). */
  readonly locationRetryCount: number;
  /** Geocoding provider id — the app resolves it to an `IGeocodingProvider` at runtime. */
  readonly geocodingProvider: string;
  /** Routing provider id for informational travel distance. */
  readonly directionsProvider: string;
  readonly isDirectionsDistanceEnabled: boolean;
  /** Maps provider key. Treat as a secret: never log it and never put it in an error message. */
  readonly mapsApiKey: string;
  readonly mapsApiBaseUrl: string;
  readonly directionsApiBaseUrl: string;
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
    locationRetryCount: 3,
    geocodingProvider: 'google',
    directionsProvider: 'google',
    isDirectionsDistanceEnabled: false,
    mapsApiKey: '',
    mapsApiBaseUrl: '',
    directionsApiBaseUrl: '',
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
  LoggerService.info(`${FILE_NAME}: readBooleanSetting: entry`, { key, fallback });

  const value = values[key];

  if (typeof value === 'boolean') {
    LoggerService.info(`${FILE_NAME}: readBooleanSetting: resolved from boolean value`, {
      key,
      value,
    });
    return value;
  }
  if (value === 'true') {
    LoggerService.info(`${FILE_NAME}: readBooleanSetting: resolved from string 'true'`, { key });
    return true;
  }
  if (value === 'false') {
    LoggerService.info(`${FILE_NAME}: readBooleanSetting: resolved from string 'false'`, { key });
    return false;
  }

  LoggerService.warn(`${FILE_NAME}: readBooleanSetting: fallback used — absent or malformed`, {
    key,
    valueType: typeof value,
    fallback,
  });
  return fallback;
}

/**
 * Reads a numeric setting, rejecting non-finite values, numeric-looking junk and
 * — when a `range` is given — anything outside the bounds the backend enforces.
 */
function readNumberSetting(
  values: SettingValues,
  key: string,
  fallback: number,
  range?: NumericRange,
): number {
  LoggerService.info(`${FILE_NAME}: readNumberSetting: entry`, {
    key,
    fallback,
    hasRange: Boolean(range),
  });

  const value = values[key];
  let numeric: number | null = null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    LoggerService.info(`${FILE_NAME}: readNumberSetting: value arrived as a finite number`, {
      key,
      value,
    });
    numeric = value;
  } else if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      LoggerService.info(`${FILE_NAME}: readNumberSetting: parsed numeric string`, { key, parsed });
    } else {
      LoggerService.warn(`${FILE_NAME}: readNumberSetting: string value is not numeric`, { key });
    }
    numeric = Number.isFinite(parsed) ? parsed : null;
  } else {
    LoggerService.warn(`${FILE_NAME}: readNumberSetting: no usable value present`, {
      key,
      valueType: typeof value,
    });
  }

  if (numeric === null) {
    LoggerService.warn(`${FILE_NAME}: readNumberSetting: fallback used — absent or malformed`, {
      key,
      fallback,
    });
    return fallback;
  }
  if (range && (numeric < range.min || numeric > range.max)) {
    LoggerService.warn(`${FILE_NAME}: readNumberSetting: fallback used — value outside range`, {
      key,
      numeric,
      min: range.min,
      max: range.max,
      fallback,
    });
    return fallback;
  }

  LoggerService.info(`${FILE_NAME}: readNumberSetting: resolved`, { key, numeric });
  return numeric;
}

/** Reads a string setting. An all-whitespace value counts as absent. */
function readStringSetting(values: SettingValues, key: string, fallback: string): string {
  LoggerService.info(`${FILE_NAME}: readStringSetting: entry`, { key });

  const value = values[key];
  // Values are never logged here: this reader also serves `maps_api_key` and
  // `support_contact_number`. Length only.
  const trimmedLength = typeof value === 'string' ? value.trim().length : 0;

  if (trimmedLength > 0) {
    LoggerService.info(`${FILE_NAME}: readStringSetting: resolved`, { key, trimmedLength });
  } else {
    LoggerService.warn(`${FILE_NAME}: readStringSetting: fallback used — absent or blank`, {
      key,
      valueType: typeof value,
      fallbackLength: fallback.length,
    });
  }

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Reads the default-language setting, ignoring any language this build can't render. */
function readLanguageSetting(
  values: SettingValues,
  key: string,
  fallback: MobileAppLanguage,
): MobileAppLanguage {
  LoggerService.info(`${FILE_NAME}: readLanguageSetting: entry`, { key, fallback });

  const value = values[key];
  const supportedLanguage = SUPPORTED_LANGUAGES.find((language) => language === value);

  if (supportedLanguage) {
    LoggerService.info(`${FILE_NAME}: readLanguageSetting: resolved`, {
      key,
      language: supportedLanguage,
    });
  } else {
    LoggerService.warn(
      `${FILE_NAME}: readLanguageSetting: fallback used — language absent or unsupported`,
      { key, valueType: typeof value, fallback },
    );
  }

  return SUPPORTED_LANGUAGES.find((language) => language === value) ?? fallback;
}

/**
 * Turns the raw settings payload into a fully typed object, substituting a safe
 * default for anything missing, malformed, or outside the range the backend
 * enforces (see `MOBILE_APP_SETTING_RANGES`).
 *
 * Pass `null` before the first fetch (or offline on a cold start) to get the
 * defaults — callers never have to null-check individual settings.
 */
export function resolveMobileAppSettings(
  settings: MobileAppSettings | null | undefined,
): ResolvedMobileAppSettings {
  LoggerService.info(`${FILE_NAME}: resolveMobileAppSettings: entry`, {
    hasSettings: Boolean(settings),
  });

  const values: SettingValues = settings?.values ?? {};
  const keys = MOBILE_APP_SETTING_KEYS;
  const defaults = DEFAULT_MOBILE_APP_SETTINGS;
  const ranges = MOBILE_APP_SETTING_RANGES;

  if (!settings) {
    LoggerService.warn(
      `${FILE_NAME}: resolveMobileAppSettings: no payload — every setting will use its default`,
    );
  } else {
    LoggerService.info(`${FILE_NAME}: resolveMobileAppSettings: reading payload`, {
      settingCount: Object.keys(values).length,
      updatedAt: settings.updatedAt,
    });
  }

  const resolved: ResolvedMobileAppSettings = {
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
      ranges.sessionTimeoutMinutes,
    ),
    maxLoginAttempts: readNumberSetting(
      values,
      keys.maxLoginAttempts,
      defaults.maxLoginAttempts,
      ranges.maxLoginAttempts,
    ),
    geoFenceRadiusMeters: readNumberSetting(
      values,
      keys.geoFenceRadiusMeters,
      defaults.geoFenceRadiusMeters,
      ranges.geoFenceRadiusMeters,
    ),
    locationRetryCount: readNumberSetting(
      values,
      keys.locationRetryCount,
      defaults.locationRetryCount,
      ranges.locationRetryCount,
    ),
    photoCompressionQuality: readNumberSetting(
      values,
      keys.photoCompressionQuality,
      defaults.photoCompressionQuality,
      ranges.photoCompressionQuality,
    ),
    maxPhotoUploadSizeMb: readNumberSetting(
      values,
      keys.maxPhotoUploadSizeMb,
      defaults.maxPhotoUploadSizeMb,
      ranges.maxPhotoUploadSizeMb,
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
      ranges.syncIntervalMinutes,
    ),
    offlineQueueRetryLimit: readNumberSetting(
      values,
      keys.offlineQueueRetryLimit,
      defaults.offlineQueueRetryLimit,
      ranges.offlineQueueRetryLimit,
    ),
    isSyncOnWifiOnly: readBooleanSetting(values, keys.isSyncOnWifiOnly, defaults.isSyncOnWifiOnly),
    geocodingProvider: readStringSetting(
      values,
      keys.geocodingProvider,
      defaults.geocodingProvider,
    ),
    directionsProvider: readStringSetting(
      values,
      keys.directionsProvider,
      defaults.directionsProvider,
    ),
    isDirectionsDistanceEnabled: readBooleanSetting(
      values,
      keys.isDirectionsDistanceEnabled,
      defaults.isDirectionsDistanceEnabled,
    ),
    mapsApiKey: readStringSetting(values, keys.mapsApiKey, defaults.mapsApiKey),
    mapsApiBaseUrl: readStringSetting(values, keys.mapsApiBaseUrl, defaults.mapsApiBaseUrl),
    directionsApiBaseUrl: readStringSetting(
      values,
      keys.directionsApiBaseUrl,
      defaults.directionsApiBaseUrl,
    ),
    values,
    updatedAt: settings?.updatedAt ?? null,
  };

  LoggerService.info(`${FILE_NAME}: resolveMobileAppSettings: resolved`, {
    defaultLanguage: resolved.defaultLanguage,
    minSupportedAppVersion: resolved.minSupportedAppVersion,
    isForceUpdateEnabled: resolved.isForceUpdateEnabled,
    isMaintenanceModeEnabled: resolved.isMaintenanceModeEnabled,
    isBiometricLoginEnabled: resolved.isBiometricLoginEnabled,
    isMockLocationBlockEnabled: resolved.isMockLocationBlockEnabled,
    sessionTimeoutMinutes: resolved.sessionTimeoutMinutes,
    maxLoginAttempts: resolved.maxLoginAttempts,
    geoFenceRadiusMeters: resolved.geoFenceRadiusMeters,
    locationRetryCount: resolved.locationRetryCount,
    geocodingProvider: resolved.geocodingProvider,
    directionsProvider: resolved.directionsProvider,
    isDirectionsDistanceEnabled: resolved.isDirectionsDistanceEnabled,
    // The key itself is a secret — only its presence is ever logged.
    hasMapsApiKey: resolved.mapsApiKey.length > 0,
    photoCompressionQuality: resolved.photoCompressionQuality,
    maxPhotoUploadSizeMb: resolved.maxPhotoUploadSizeMb,
    isWatermarkEnabled: resolved.isWatermarkEnabled,
    syncIntervalMinutes: resolved.syncIntervalMinutes,
    offlineQueueRetryLimit: resolved.offlineQueueRetryLimit,
    isSyncOnWifiOnly: resolved.isSyncOnWifiOnly,
    updatedAt: resolved.updatedAt,
  });
  return resolved;
}

/**
 * The two settings geo-fencing cannot run without.
 *
 * Separate from `ResolvedMobileAppSettings` on purpose: everywhere else a
 * missing setting quietly falls back to a safe default, but a geo-fence
 * decision made against a *guessed* radius would either wave through a field
 * executive who is nowhere near the address or lock out one who is standing at
 * the door. So this reader is strict — see `resolveGeoFenceConfiguration`.
 */
export interface GeoFenceConfiguration {
  readonly geoFenceRadiusMeters: number;
  readonly locationRetryCount: number;
}

/**
 * Reads the geo-fence configuration, or `null` when the payload has never
 * arrived or either value is missing, malformed, or outside the range the
 * back office enforces. A `null` result must block geo-fence access rather
 * than fall back to a default.
 */
export function resolveGeoFenceConfiguration(
  settings: MobileAppSettings | null | undefined,
): GeoFenceConfiguration | null {
  LoggerService.info(`${FILE_NAME}: resolveGeoFenceConfiguration: entry`, {
    hasSettings: Boolean(settings),
  });

  if (!settings) {
    LoggerService.warn(
      `${FILE_NAME}: resolveGeoFenceConfiguration: rejected — settings payload has never arrived`,
    );
    return null;
  }

  const values: SettingValues = settings.values;
  const radiusRange = MOBILE_APP_SETTING_RANGES.geoFenceRadiusMeters;
  const retryRange = MOBILE_APP_SETTING_RANGES.locationRetryCount;

  // `NaN` as the fallback means "absent or malformed" — no real setting can
  // produce it, so it can't be confused with a configured value.
  const geoFenceRadiusMeters = readNumberSetting(
    values,
    MOBILE_APP_SETTING_KEYS.geoFenceRadiusMeters,
    Number.NaN,
    radiusRange,
  );
  const locationRetryCount = readNumberSetting(
    values,
    MOBILE_APP_SETTING_KEYS.locationRetryCount,
    Number.NaN,
    retryRange,
  );

  if (!Number.isFinite(geoFenceRadiusMeters) || !Number.isFinite(locationRetryCount)) {
    LoggerService.warn(
      `${FILE_NAME}: resolveGeoFenceConfiguration: rejected — a required value is missing, malformed or out of range`,
      {
        hasRadius: Number.isFinite(geoFenceRadiusMeters),
        hasRetryCount: Number.isFinite(locationRetryCount),
        radiusMin: radiusRange.min,
        radiusMax: radiusRange.max,
        retryMin: retryRange.min,
        retryMax: retryRange.max,
      },
    );
    return null;
  }

  LoggerService.info(`${FILE_NAME}: resolveGeoFenceConfiguration: resolved`, {
    geoFenceRadiusMeters,
    locationRetryCount,
  });
  return { geoFenceRadiusMeters, locationRetryCount };
}
