import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { LoggerService } from '@/infrastructure/logger';
import type {
  DeviceLocation,
  LocationReadinessStatus,
  LocationUnavailableReason,
} from '@/infrastructure/location';

import { isLocationReady, useLocationStore } from './location.store';

const FILE_NAME = 'use-location-readiness.ts';

export interface UseLocationReadinessResult {
  readonly status: LocationReadinessStatus;
  readonly location: DeviceLocation | null;
  readonly errorReason: LocationUnavailableReason | null;
  readonly isEvaluating: boolean;
  /** `true` only when `status` is `ready` — the sole state that permits normal app actions. */
  readonly isReady: boolean;
  /** Re-evaluates on demand, e.g. a banner's retry button. */
  readonly recheck: () => Promise<void>;
  readonly requestPermission: () => Promise<void>;
  readonly openSettings: () => Promise<void>;
}

/** Reads location readiness and exposes the actions a blocking banner needs. */
export function useLocationReadiness(): UseLocationReadinessResult {

  const status = useLocationStore((state) => state.status);
  const location = useLocationStore((state) => state.location);
  const errorReason = useLocationStore((state) => state.errorReason);
  const isEvaluating = useLocationStore((state) => state.isEvaluating);
  const evaluate = useLocationStore((state) => state.evaluate);
  const requestPermission = useLocationStore((state) => state.requestPermission);
  const openSettings = useLocationStore((state) => state.openSettings);
 
  const recheck = useCallback(async (): Promise<void> => {
    // Wrapped rather than handed out directly, so a press handler can never
    // pass its event object through as the evaluation trigger.
    LoggerService.info(`${FILE_NAME}: recheck: re-evaluating readiness on demand`);
    await evaluate('manual_recheck');
  }, [evaluate]);

  LoggerService.info(`${FILE_NAME}: useLocationReadiness: reading readiness`, { status });
  LoggerService.info(`${FILE_NAME}: useLocationReadiness: returning readiness snapshot`, {
    status,
    hasLocation: location !== null,
    errorReason,
    isEvaluating,
  });

  return {
    status,
    location,
    errorReason,
    isEvaluating,
    isReady: isLocationReady(status),
    recheck,
    requestPermission,
    openSettings,
  };
}

/**
 * Keeps location readiness honest for as long as it's mounted: evaluates once
 * when it becomes active, and re-evaluates whenever the app returns to the
 * foreground — which is how a permission change, a location-services toggle,
 * or a mock-location app switched on outside the app gets noticed.
 *
 * Mounted once, in the application shell. `isActive` is false before login so
 * the permission prompt doesn't appear over the Login screen.
 */
export function useLocationReadinessMonitor(isActive: boolean): void {
  const evaluate = useLocationStore((state) => state.evaluate);
  const reset = useLocationStore((state) => state.reset);

  LoggerService.info(`${FILE_NAME}: useLocationReadinessMonitor: rendering`, { isActive });

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: useLocationReadinessMonitor: effect running`, { isActive });
    if (!isActive) {
      LoggerService.info(`${FILE_NAME}: useLocationReadinessMonitor: inactive, clearing readiness`);
      reset();
      LoggerService.info(
        `${FILE_NAME}: useLocationReadinessMonitor: effect finished with no listener attached`,
      );
      return;
    }

    LoggerService.info(
      `${FILE_NAME}: useLocationReadinessMonitor: activating, evaluating readiness`,
    );
    // The first evaluation of a session is the post-login one — the check that
    // catches a fake-GPS app that was already running when the executive
    // signed in, and reports it before any case can be worked.
    void evaluate('post_login');

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      LoggerService.info(`${FILE_NAME}: handleAppStateChange: app state changed`, { nextState });
      if (nextState !== 'active') {
        LoggerService.info(
          `${FILE_NAME}: handleAppStateChange: not active, skipping re-evaluation`,
          { nextState },
        );
        return;
      }
      LoggerService.info(`${FILE_NAME}: useLocationReadinessMonitor: app resumed, re-evaluating`);
      void evaluate('app_resume');
    });

    LoggerService.info(`${FILE_NAME}: useLocationReadinessMonitor: app state listener attached`);

    return () => {
      LoggerService.info(`${FILE_NAME}: useLocationReadinessMonitor: detaching app state listener`);
      subscription.remove();
      LoggerService.info(`${FILE_NAME}: useLocationReadinessMonitor: cleanup complete`);
    };
  }, [evaluate, isActive, reset]);
}
