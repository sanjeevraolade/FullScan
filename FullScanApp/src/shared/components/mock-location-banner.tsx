import React from 'react';
import type { ReactElement } from 'react';
import { AlertCircleIcon } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { useLocationReadiness } from '@/store/location';

import { BottomBlockingBanner } from './bottom-blocking-banner';

const FILE_NAME = 'mock-location-banner.tsx';

/**
 * Red persistent bottom banner shown while a mocked/faked device location is
 * detected — the one condition where the app has to assume the evidence would
 * be fraudulent, so normal actions stay blocked until the user turns the mock
 * provider off.
 *
 * Drop it into any screen: it reads the app-wide readiness state itself and
 * renders nothing unless the status is `mock_detected`. Re-checking happens on
 * app resume (see `useLocationReadinessMonitor`) and via its own retry action,
 * so switching the mock app off clears the banner without a restart.
 */
export function MockLocationBanner(): ReactElement | null {
  const { status, isEvaluating, recheck, openSettings } = useLocationReadiness();

  LoggerService.info(`${FILE_NAME}: MockLocationBanner: rendering`, { status });
  const { t } = useTranslation();

  if (status !== 'mock_detected') {
    LoggerService.info(`${FILE_NAME}: MockLocationBanner: no mock location, rendering nothing`, {
      status,
    });
    return null;
  }

  LoggerService.warn(`${FILE_NAME}: MockLocationBanner: rendering mock-location banner`, {
    isEvaluating,
  });

  const handleRecheck = (): void => {
    LoggerService.warn(`${FILE_NAME}: handleRecheck: re-checking after mock location detection`);
    void recheck();
  };

  const handleOpenSettings = (): void => {
    LoggerService.warn(`${FILE_NAME}: handleOpenSettings: opening developer/location settings`);
    void openSettings();
  };

  return (
    <BottomBlockingBanner
      tone="error"
      icon={AlertCircleIcon}
      message={t('location.mock.title')}
      detail={t('location.mock.detail')}
      primaryAction={{
        label: t('location.actions.retry'),
        onPress: handleRecheck,
        isBusy: isEvaluating,
        testID: 'mock-location-banner-retry-button',
      }}
      secondaryAction={{
        label: t('location.actions.openSettings'),
        onPress: handleOpenSettings,
        testID: 'mock-location-banner-settings-button',
      }}
      testID="mock-location-banner"
    />
  );
}
