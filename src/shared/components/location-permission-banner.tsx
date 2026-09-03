import React from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { useLocationReadiness } from '@/store/location';

import { BottomBlockingBanner } from './bottom-blocking-banner';
import { MapPinIcon } from './icons/map-pin-icon';
import { SettingsIcon } from './icons/settings-icon';

const FILE_NAME = 'location-permission-banner.tsx';

/**
 * Persistent bottom banner for every location state that is *not* about a
 * faked position: unsupported hardware, location services switched off,
 * permission not yet granted, permission permanently denied, and a failed fix.
 *
 * Drop it into any screen — it reads the app-wide readiness state itself and
 * renders nothing when location is ready (or when the offending state is a
 * mock location, which `MockLocationBanner` owns). It offers the right action
 * per state: prompt when the permission is still askable, open Settings when
 * it isn't, retry when the fix simply failed.
 */
export function LocationPermissionBanner(): ReactElement | null {
  const { t } = useTranslation();
  const { status, errorReason, isEvaluating, recheck, requestPermission, openSettings } =
    useLocationReadiness();

  LoggerService.info(`${FILE_NAME}: LocationPermissionBanner: rendering`, { status });

  if (status === 'ready' || status === 'unknown' || status === 'mock_detected') {
    LoggerService.info(`${FILE_NAME}: LocationPermissionBanner: nothing to show for status`, {
      status,
    });
    return null;
  }

  const handleRequestPermission = (): void => {
    LoggerService.info(`${FILE_NAME}: handleRequestPermission: prompting for permission`);
    void requestPermission();
  };

  const handleOpenSettings = (): void => {
    LoggerService.info(`${FILE_NAME}: handleOpenSettings: opening settings`, { status });
    void openSettings();
  };

  const handleRecheck = (): void => {
    LoggerService.info(`${FILE_NAME}: handleRecheck: re-evaluating location readiness`);
    void recheck();
  };

  const retryAction = {
    label: t('location.actions.retry'),
    onPress: handleRecheck,
    isBusy: isEvaluating,
    testID: 'location-banner-retry-button',
  };
  const settingsAction = {
    label: t('location.actions.openSettings'),
    onPress: handleOpenSettings,
    testID: 'location-banner-settings-button',
  };

  switch (status) {
    case 'unsupported':
      LoggerService.warn(
        `${FILE_NAME}: LocationPermissionBanner: rendering unsupported-hardware banner`,
      );
      return (
        <BottomBlockingBanner
          tone="error"
          icon={MapPinIcon}
          message={t('location.mandatory')}
          detail={t('location.unsupported')}
          testID="location-permission-banner"
        />
      );

    case 'service_disabled':
      LoggerService.warn(
        `${FILE_NAME}: LocationPermissionBanner: rendering service-disabled banner`,
      );
      return (
        <BottomBlockingBanner
          tone="error"
          icon={SettingsIcon}
          message={t('location.mandatory')}
          detail={t('location.serviceDisabled')}
          primaryAction={settingsAction}
          secondaryAction={retryAction}
          testID="location-permission-banner"
        />
      );

    case 'permission_required':
      LoggerService.warn(
        `${FILE_NAME}: LocationPermissionBanner: rendering permission-required banner`,
      );
      return (
        <BottomBlockingBanner
          tone="error"
          icon={MapPinIcon}
          message={t('location.mandatory')}
          detail={t('location.permissionRequired')}
          primaryAction={{
            label: t('location.actions.grantPermission'),
            onPress: handleRequestPermission,
            testID: 'location-banner-grant-button',
          }}
          testID="location-permission-banner"
        />
      );

    case 'permission_denied':
      LoggerService.warn(
        `${FILE_NAME}: LocationPermissionBanner: rendering permission-blocked banner`,
      );
      return (
        <BottomBlockingBanner
          tone="error"
          icon={SettingsIcon}
          message={t('location.mandatory')}
          detail={t('location.permissionBlocked')}
          primaryAction={settingsAction}
          secondaryAction={retryAction}
          testID="location-permission-banner"
        />
      );

    case 'obtaining_location':
      LoggerService.info(
        `${FILE_NAME}: LocationPermissionBanner: rendering obtaining-location banner`,
      );
      return (
        <BottomBlockingBanner
          tone="warning"
          icon={MapPinIcon}
          message={t('location.obtaining')}
          detail={t('location.obtainingDetail')}
          testID="location-permission-banner"
        />
      );

    default:
      LoggerService.warn(`${FILE_NAME}: LocationPermissionBanner: rendering fix-failed banner`, {
        status,
        errorReason: errorReason ?? 'unavailable',
      });
      return (
        <BottomBlockingBanner
          tone="error"
          icon={MapPinIcon}
          message={t('location.mandatory')}
          detail={t(
            errorReason === 'timeout'
              ? 'location.errors.timeout'
              : errorReason === 'service_disabled'
              ? 'location.serviceDisabled'
              : 'location.errors.unavailable',
          )}
          primaryAction={retryAction}
          testID="location-permission-banner"
        />
      );
  }
}
