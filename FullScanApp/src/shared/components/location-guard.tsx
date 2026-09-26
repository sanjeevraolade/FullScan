import React from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { Box } from '@gluestack-ui/themed';

import { LoggerService } from '@/infrastructure/logger';
import { useLocationReadiness } from '@/store/location';

import { LocationPermissionBanner } from './location-permission-banner';
import { MockLocationBanner } from './mock-location-banner';

const FILE_NAME = 'location-guard.tsx';

export interface LocationGuardProps {
  /**
   * When false the guard is a pass-through — used before login, where the
   * Login screen must stay usable and no permission prompt should appear.
   */
  readonly isEnforced: boolean;
}

/**
 * Wraps the app's content and enforces "normal usage only when location is
 * ready".
 *
 * While the status is anything other than `ready`, a transparent layer over
 * the content swallows touches — so every button, field and gesture below is
 * blocked, not merely discouraged — and the matching persistent bottom banner
 * explains what to fix. The banners themselves sit above that layer, so their
 * own actions (grant permission, open Settings, retry) stay tappable.
 *
 * The content keeps rendering underneath rather than being replaced, so the
 * field executive never loses their place in a case.
 */
export function LocationGuard({
  isEnforced,
  children,
}: PropsWithChildren<LocationGuardProps>): ReactElement {
  const { status, isReady } = useLocationReadiness();
  const isBlocking = isEnforced && !isReady && status !== 'unknown';

  LoggerService.info(`${FILE_NAME}: LocationGuard: rendering`, { isEnforced, status, isBlocking });

  if (!isEnforced) {
    LoggerService.info(
      `${FILE_NAME}: LocationGuard: enforcement off, passing content through untouched`,
      { status },
    );
  } else if (isBlocking) {
    LoggerService.warn(
      `${FILE_NAME}: LocationGuard: blocking interaction — location is not ready`,
      { status, isReady },
    );
  } else if (status === 'unknown') {
    LoggerService.info(
      `${FILE_NAME}: LocationGuard: readiness not evaluated yet, not blocking`,
      { status },
    );
  } else {
    LoggerService.info(`${FILE_NAME}: LocationGuard: location ready, not blocking`, { status });
  }

  if (isEnforced) {
    LoggerService.info(`${FILE_NAME}: LocationGuard: rendering location banners`, { status });
  }

  return (
    <Box flex={1}>
      {/*
        While blocked, the content is hidden from assistive technology as well
        as being untouchable — otherwise a screen-reader user could still
        activate a control the overlay covers.
      */}
      <Box
        flex={1}
        accessibilityElementsHidden={isBlocking}
        importantForAccessibility={isBlocking ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </Box>
      {isBlocking ? (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          // Interaction blocker: no background so the screen stays readable,
          // but every touch lands here instead of on the content.
          testID="location-blocking-overlay"
        />
      ) : null}
      {isEnforced ? (
        <>
          <LocationPermissionBanner />
          <MockLocationBanner />
        </>
      ) : null}
    </Box>
  );
}
