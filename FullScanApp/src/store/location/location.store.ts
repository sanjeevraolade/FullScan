import { create } from 'zustand';

import { LoggerService } from '@/infrastructure/logger';
import { LocationService, isLocationUnavailableError } from '@/infrastructure/location';
import type {
  DeviceLocation,
  LocationReadinessStatus,
  LocationUnavailableReason,
} from '@/infrastructure/location';
import {
  flushPendingMockLocationReports,
  recordMockLocationDetection,
  resetMockLocationReportThrottle,
} from './mock-location-reporter';

const FILE_NAME = 'location.store.ts';

/**
 * Guards against overlapping evaluations: an app-resume re-check and a manual
 * retry can land together, and the slower one must not overwrite the newer
 * result. Only the most recently started evaluation is allowed to publish.
 */
let latestEvaluationId = 0;

/**
 * Why readiness is being evaluated. Carried through to a mock-location report
 * so the back office can tell a fake GPS that was already running at login from
 * one switched on later.
 */
export type LocationEvaluationTrigger = 'post_login' | 'app_resume' | 'manual_recheck';

export interface LocationState {
  readonly status: LocationReadinessStatus;
  /** The last fresh fix, or `null` whenever the status is not `ready`. */
  readonly location: DeviceLocation | null;
  /** Set alongside the `error` status so the UI can explain the failure. */
  readonly errorReason: LocationUnavailableReason | null;
  readonly isEvaluating: boolean;
  readonly lastEvaluatedAt: Date | null;
  evaluate: (trigger?: LocationEvaluationTrigger) => Promise<void>;
  requestPermission: () => Promise<void>;
  openSettings: () => Promise<void>;
  reset: () => void;
}

/**
 * Whether normal app actions are allowed. `ready` is the only permissive
 * state — everything else means the app is blocked behind a banner.
 */
export function isLocationReady(status: LocationReadinessStatus): boolean {
  const isReady = status === 'ready';
  LoggerService.info(`${FILE_NAME}: isLocationReady: evaluated readiness gate`, {
    status,
    isReady,
  });
  return isReady;
}

/**
 * Device-location readiness for the whole app: support, services, permission,
 * a current fix, and mock-location detection, collapsed into one status.
 *
 * Evaluated right after login (`Login Success → Load mobileAppSettings →
 * Validate Location → App Ready`), again whenever the app returns to the
 * foreground, and on demand from a banner's retry button.
 */
export const useLocationStore = create<LocationState>((set, get) => ({
  status: 'unknown',
  location: null,
  errorReason: null,
  isEvaluating: false,
  lastEvaluatedAt: null,

  evaluate: async (trigger: LocationEvaluationTrigger = 'manual_recheck'): Promise<void> => {
    // Read before anything overwrites it: a detection that repeats an episode
    // already reported is throttled rather than re-sent on every app resume.
    const previousStatus = get().status;
    latestEvaluationId += 1;
    const evaluationId = latestEvaluationId;
    const isStale = (): boolean => {
      const stale = evaluationId !== latestEvaluationId;
      if (stale) {
        LoggerService.warn(`${FILE_NAME}: isStale: this evaluation is no longer the latest`, {
          evaluationId,
          latestEvaluationId,
        });
        return true;
      }
      LoggerService.info(`${FILE_NAME}: isStale: this evaluation is still the latest`, {
        evaluationId,
      });
      return false;
    };

    const publish = (
      status: LocationReadinessStatus,
      location: DeviceLocation | null,
      errorReason: LocationUnavailableReason | null,
    ): void => {
      LoggerService.info(`${FILE_NAME}: publish: publish requested`, { status, errorReason });
      if (isStale()) {
        LoggerService.info(`${FILE_NAME}: evaluate: superseded by a newer evaluation, discarding`, {
          status,
        });
        return;
      }
      LoggerService.info(`${FILE_NAME}: evaluate: publishing readiness`, { status, errorReason });
      set({ status, location, errorReason, isEvaluating: false, lastEvaluatedAt: new Date() });
    };

    LoggerService.info(`${FILE_NAME}: evaluate: starting location readiness evaluation`, {
      trigger,
      previousStatus,
    });
    set({ isEvaluating: true });

    try {
      if (!(await LocationService.isSupported())) {
        LoggerService.warn(`${FILE_NAME}: evaluate: device location is not supported`);
        publish('unsupported', null, null);
        return;
      }
      LoggerService.info(`${FILE_NAME}: evaluate: device location is supported`);

      const permissionStatus = await LocationService.checkPermission();
      LoggerService.info(`${FILE_NAME}: evaluate: permission checked`, { permissionStatus });
      if (permissionStatus === 'unavailable') {
        LoggerService.warn(`${FILE_NAME}: evaluate: permission unavailable on this device`);
        publish('unsupported', null, null);
        return;
      }
      if (permissionStatus === 'blocked') {
        // Permanently denied — only a trip to Settings changes this.
        LoggerService.warn(`${FILE_NAME}: evaluate: permission permanently blocked`);
        publish('permission_denied', null, null);
        return;
      }
      if (permissionStatus === 'denied') {
        LoggerService.warn(`${FILE_NAME}: evaluate: permission denied, a prompt is required`);
        publish('permission_required', null, null);
        return;
      }

      if (!isStale()) {
        LoggerService.info(`${FILE_NAME}: evaluate: moving to obtaining_location`);
        set({ status: 'obtaining_location', location: null, errorReason: null });
      } else {
        LoggerService.warn(
          `${FILE_NAME}: evaluate: skipping the obtaining_location transition, superseded`,
        );
      }

      const location = await LocationService.getCurrentLocation();
      LoggerService.info(`${FILE_NAME}: evaluate: location fix received`, {
        source: location.source,
        isMockLocation: location.isMockLocation,
      });

      if (location.isMockLocation) {
        // Always blocked and always reported — there is no configuration that
        // lets a faked position through. The fake coordinates go up with the
        // report: they are the evidence.
        LoggerService.warn(
          `${FILE_NAME}: evaluate: mock location detected, reporting it and blocking app actions`,
          { trigger },
        );
        void recordMockLocationDetection({
          detectionStage: trigger,
          location,
          isRepeatDetection: previousStatus === 'mock_detected',
        });
        publish('mock_detected', null, null);
        return;
      }

      // Any detection captured while offline is still owed to the back office.
      void flushPendingMockLocationReports();

      if (location.source !== 'fresh') {
        // A cached fix is not where the field executive is standing now, so it
        // can never make the app ready — the user retries instead.
        LoggerService.warn(`${FILE_NAME}: evaluate: only a stale fix was available`);
        publish('error', null, 'position_unavailable');
        return;
      }

      LoggerService.info(`${FILE_NAME}: evaluate: a fresh fix makes the app ready`);
      publish('ready', location, null);
    } catch (error: unknown) {
      if (isLocationUnavailableError(error)) {
        LoggerService.warn(`${FILE_NAME}: evaluate: location unavailable`, {
          reason: error.reason,
        });
        if (error.reason === 'service_disabled') {
          publish('service_disabled', null, error.reason);
          return;
        }
        if (error.reason === 'permission_denied') {
          publish('permission_required', null, error.reason);
          return;
        }
        publish('error', null, error.reason);
        return;
      }

      LoggerService.error(`${FILE_NAME}: evaluate: unexpected failure`, {
        message: error instanceof Error ? error.message : String(error),
      });
      publish('error', null, 'unknown');
    }
  },

  requestPermission: async (): Promise<void> => {
    LoggerService.info(`${FILE_NAME}: requestPermission: prompting for location permission`);
    const permissionStatus = await LocationService.requestPermission();
    LoggerService.info(`${FILE_NAME}: requestPermission: prompt resolved`, { permissionStatus });

    if (permissionStatus === 'granted') {
      LoggerService.info(`${FILE_NAME}: requestPermission: granted, re-evaluating readiness`);
      await get().evaluate();
      return;
    }

    const status: LocationReadinessStatus =
      permissionStatus === 'blocked'
        ? 'permission_denied'
        : permissionStatus === 'unavailable'
        ? 'unsupported'
        : 'permission_required';
    LoggerService.warn(`${FILE_NAME}: requestPermission: permission not granted`, { status });
    set({
      status,
      location: null,
      errorReason: null,
      isEvaluating: false,
      lastEvaluatedAt: new Date(),
    });
  },

  openSettings: async (): Promise<void> => {
    const { status } = get();
    LoggerService.info(`${FILE_NAME}: openSettings: sending the user to settings`, { status });
    if (status === 'service_disabled' || status === 'mock_detected' || status === 'unsupported') {
      // Mock locations are enabled in Developer options and location services
      // in system settings — both live outside the app's own settings page.
      LoggerService.info(`${FILE_NAME}: openSettings: opening system location settings`, {
        status,
      });
      await LocationService.openLocationServiceSettings();
      return;
    }
    LoggerService.info(`${FILE_NAME}: openSettings: opening the application settings page`, {
      status,
    });
    await LocationService.openApplicationSettings();
  },

  reset: (): void => {
    LoggerService.info(`${FILE_NAME}: reset: clearing location readiness`);
    // A new session must report a mock location again, even on the same handset.
    resetMockLocationReportThrottle();
    latestEvaluationId += 1;
    LoggerService.info(`${FILE_NAME}: reset: invalidated any in-flight evaluation`, {
      latestEvaluationId,
    });
    set({
      status: 'unknown',
      location: null,
      errorReason: null,
      isEvaluating: false,
      lastEvaluatedAt: null,
    });
  },
}));
