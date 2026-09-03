import { useMemo } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { resolveGeoFenceConfiguration, resolveMobileAppSettings } from '@/domain/reference-data';
import type { GeoFenceConfiguration, ResolvedMobileAppSettings } from '@/domain/reference-data';

import { useReferenceDataStore } from './reference-data.store';

const FILE_NAME = 'use-mobile-app-settings.ts';

/**
 * Admin-managed remote configuration, as a fully typed object with safe
 * defaults — the way screens, hooks and services should read settings.
 *
 * Delivered with the post-login reference-data payload, so before the first
 * fetch (and on a cold start with no network) this returns
 * `DEFAULT_MOBILE_APP_SETTINGS` rather than null: callers never null-check an
 * individual setting, and the app stays usable offline.
 */
export function useMobileAppSettings(): ResolvedMobileAppSettings {
  const mobileAppSettings = useReferenceDataStore(
    (state) => state.referenceData?.mobileAppSettings ?? null,
  );

  LoggerService.info(`${FILE_NAME}: useMobileAppSettings: reading mobile app settings`, {
    hasMobileAppSettings: mobileAppSettings !== null,
  });

  return useMemo(() => {
    LoggerService.info(`${FILE_NAME}: useMobileAppSettings: resolving mobile app settings`, {
      hasMobileAppSettings: mobileAppSettings !== null,
    });
    const resolved = resolveMobileAppSettings(mobileAppSettings);
    if (mobileAppSettings === null) {
      LoggerService.warn(
        `${FILE_NAME}: useMobileAppSettings: no server payload yet, falling back to defaults`,
      );
    }
    LoggerService.info(`${FILE_NAME}: useMobileAppSettings: resolved mobile app settings`, {
      isUsingDefaults: mobileAppSettings === null,
      settingCount: Object.keys(resolved.values).length,
      updatedAt: resolved.updatedAt,
    });
    return resolved;
  }, [mobileAppSettings]);
}

/**
 * The geo-fence configuration, or `null` when the server payload hasn't
 * arrived or either required value is missing/invalid.
 *
 * Deliberately *not* defaulted, unlike `useMobileAppSettings`: a geo-fence
 * decision made against a guessed radius or retry limit is worse than no
 * decision, so callers must block access on `null` rather than fall back.
 */
export function useGeoFenceConfiguration(): GeoFenceConfiguration | null {
  const mobileAppSettings = useReferenceDataStore(
    (state) => state.referenceData?.mobileAppSettings ?? null,
  );

  LoggerService.info(`${FILE_NAME}: useGeoFenceConfiguration: reading geo-fence configuration`, {
    hasMobileAppSettings: mobileAppSettings !== null,
  });

  return useMemo(() => {
    LoggerService.info(`${FILE_NAME}: useGeoFenceConfiguration: resolving geo-fence configuration`);
    const configuration = resolveGeoFenceConfiguration(mobileAppSettings);
    if (configuration === null) {
      LoggerService.warn(
        `${FILE_NAME}: useGeoFenceConfiguration: geo-fence is not configured, callers must block`,
      );
    }
    LoggerService.info(`${FILE_NAME}: useGeoFenceConfiguration: resolved geo-fence configuration`, {
      isConfigured: configuration !== null,
      geoFenceRadiusMeters: configuration?.geoFenceRadiusMeters ?? null,
      locationRetryCount: configuration?.locationRetryCount ?? null,
    });
    return configuration;
  }, [mobileAppSettings]);
}

/**
 * Non-reactive read of the geo-fence configuration.
 *
 * Exists so an async routine that started before the configuration arrived
 * reads the *current* values when it actually runs, instead of the ones its
 * closure captured — a stale radius must never decide a geo-fence.
 */
export function getGeoFenceConfiguration(): GeoFenceConfiguration | null {
  LoggerService.info(`${FILE_NAME}: getGeoFenceConfiguration: starting`);
  const { referenceData } = useReferenceDataStore.getState();
  if (!referenceData) {
    LoggerService.warn(
      `${FILE_NAME}: getGeoFenceConfiguration: no reference data in the store yet`,
    );
  }
  const configuration = resolveGeoFenceConfiguration(referenceData?.mobileAppSettings ?? null);
  LoggerService.info(`${FILE_NAME}: getGeoFenceConfiguration: reading geo-fence configuration`, {
    isConfigured: configuration !== null,
  });
  return configuration;
}

/**
 * Non-reactive read, for code outside React (repositories, services, saga
 * side effects) that needs the current configuration once.
 */
export function getMobileAppSettings(): ResolvedMobileAppSettings {
  const { referenceData } = useReferenceDataStore.getState();
  LoggerService.info(`${FILE_NAME}: getMobileAppSettings: reading mobile app settings`, {
    isUsingDefaults: referenceData === null,
  });
  const resolved = resolveMobileAppSettings(referenceData?.mobileAppSettings ?? null);
  LoggerService.info(`${FILE_NAME}: getMobileAppSettings: resolved mobile app settings`, {
    settingCount: Object.keys(resolved.values).length,
    updatedAt: resolved.updatedAt,
  });
  return resolved;
}
