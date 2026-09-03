import { useMemo } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { resolveMobileAppSettings } from '@/domain/reference-data';
import type { ResolvedMobileAppSettings } from '@/domain/reference-data';

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

  return useMemo(() => {
    const resolved = resolveMobileAppSettings(mobileAppSettings);
    LoggerService.info(`${FILE_NAME}: useMobileAppSettings: resolved mobile app settings`, {
      isUsingDefaults: mobileAppSettings === null,
      settingCount: Object.keys(resolved.values).length,
      updatedAt: resolved.updatedAt,
    });
    return resolved;
  }, [mobileAppSettings]);
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
  return resolveMobileAppSettings(referenceData?.mobileAppSettings ?? null);
}
