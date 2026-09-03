import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasUsableGeoCoordinates } from '@/core/utils';
import type { GeoCoordinates } from '@/core/types';
import { LoggerService } from '@/infrastructure/logger';
import { DistanceService } from '@/infrastructure/distance';
import type { DirectionsProviderConfiguration, DistanceMethod } from '@/infrastructure/distance';
import { GeocodingService, isGeocodingFailedError } from '@/infrastructure/geocoding';
import type { GeocodingFailureReason } from '@/infrastructure/geocoding';
import { evaluateGeoFence } from '@/domain/geo-fence';
import type { GeoFenceBypassConsent } from '@/domain/geo-fence';
import {
  getGeoFenceConfiguration,
  useGeoFenceConfiguration,
  useMobileAppSettings,
  useReferenceDataLoader,
} from '@/store/reference-data';
import { useLocationStore } from '@/store/location';
import { useGeoFenceBypassStore } from '@/store/geo-fence';

const FILE_NAME = 'use-case-geo-fence.ts';

/**
 * Where the Case Location section is in its lifecycle. Case Details reveals
 * the sections below Case Location only for `inside` — or when the user has
 * explicitly consented to the Force Proceed bypass.
 */
export type CaseGeoFenceStatus =
  /** Nothing attempted yet (case detail still loading). */
  | 'idle'
  /** `geo_fence_radius_meters` / `locationRetryCount` missing or invalid — access is refused, not defaulted. */
  | 'configuration_unavailable'
  /** Device location is not ready; the app-wide blocking banner owns this state. */
  | 'awaiting_location'
  | 'resolving_case_location'
  | 'measuring'
  /** The case's location could not be determined (no coordinates and the address wouldn't resolve). */
  | 'case_location_unresolved'
  | 'inside'
  | 'outside'
  | 'error';

export interface UseCaseGeoFenceParams {
  readonly caseId: string;
  readonly address: string;
  /** The case's server-side coordinates. `0,0` and out-of-range values count as absent. */
  readonly targetCoordinates: GeoCoordinates | null;
  /** False while the case detail is still loading, so nothing runs against placeholder data. */
  readonly isEnabled: boolean;
}

export interface UseCaseGeoFenceResult {
  readonly status: CaseGeoFenceStatus;
  /** True only when the geo-fence passed or the user consented to bypass it. */
  readonly isCaseContentUnlocked: boolean;
  readonly isBusy: boolean;
  readonly distanceMeters: number | null;
  readonly distanceMethod: DistanceMethod | null;
  readonly radiusMeters: number | null;
  readonly caseCoordinates: GeoCoordinates | null;
  /** True when the case's coordinates came from the offline geocoding cache. */
  readonly isCaseLocationFromCache: boolean;
  readonly unresolvedReason: GeocodingFailureReason | null;
  /** Recalculation attempts the user has made (the initial automatic run doesn't count). */
  readonly attemptCount: number;
  readonly remainingAttempts: number;
  /** True once the retry budget is used up and the geo-fence still isn't satisfied. */
  readonly canForceProceed: boolean;
  readonly bypassConsent: GeoFenceBypassConsent | null;
  readonly recalculate: () => Promise<void>;
  readonly confirmForceProceed: () => void;
}

/**
 * Owns the Case Details geo-fence check end to end: find the case's location,
 * measure how far the device is from it, compare that against the
 * server-configured radius, and track the retry/Force-Proceed escape hatch.
 *
 * Two rules shape the whole flow:
 *
 * 1. **Server configuration is required.** With no valid
 *    `geo_fence_radius_meters` / `locationRetryCount` the hook reports
 *    `configuration_unavailable` and unlocks nothing — a guessed radius could
 *    wave through a field executive who never visited the address.
 * 2. **A decision never depends on the network.** Once the case's coordinates
 *    are known (from the payload or the geocoding cache) and the device has a
 *    fresh fix, the Haversine calculation always produces the answer, offline
 *    included. A routing API may refine the *displayed* distance, but it can
 *    never block or change the pass/fail outcome.
 */
export function useCaseGeoFence({
  caseId,
  address,
  targetCoordinates,
  isEnabled,
}: UseCaseGeoFenceParams): UseCaseGeoFenceResult {
  LoggerService.info(`${FILE_NAME}: useCaseGeoFence: hook invoked`, {
    caseId,
    isEnabled,
    hasTargetCoordinates: targetCoordinates !== null,
    addressLength: address.length,
  });
  const settings = useMobileAppSettings();
  const geoFenceConfiguration = useGeoFenceConfiguration();
  const { reload: reloadReferenceData } = useReferenceDataLoader();
  // Subscribing to the readiness *status* rather than the fix itself keeps a
  // re-measurement tied to "location became usable", not to every GPS update.
  const locationStatus = useLocationStore((state) => state.status);
  const evaluateLocationReadiness = useLocationStore((state) => state.evaluate);
  const bypassConsent = useGeoFenceBypassStore((state) => state.consentsByCaseId[caseId] ?? null);
  const grantBypassConsent = useGeoFenceBypassStore((state) => state.grantConsent);

  const [status, setStatus] = useState<CaseGeoFenceStatus>('idle');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [distanceMethod, setDistanceMethod] = useState<DistanceMethod | null>(null);
  const [caseCoordinates, setCaseCoordinates] = useState<GeoCoordinates | null>(null);
  const [isCaseLocationFromCache, setIsCaseLocationFromCache] = useState(false);
  const [unresolvedReason, setUnresolvedReason] = useState<GeocodingFailureReason | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  /**
   * Resolved case coordinates survive re-measurement: geocoding an address is
   * a billable request, so once it has succeeded a Recalculate only re-reads
   * the GPS fix.
   */
  const resolvedCaseCoordinatesRef = useRef<GeoCoordinates | null>(null);
  /** Discards the result of a measurement the screen has already moved past. */
  const measurementIdRef = useRef(0);

  const radiusMeters = geoFenceConfiguration?.geoFenceRadiusMeters ?? null;
  const locationRetryCount = geoFenceConfiguration?.locationRetryCount ?? null;

  if (geoFenceConfiguration === null) {
    LoggerService.warn(`${FILE_NAME}: useCaseGeoFence: no geo-fence configuration available`, {
      caseId,
    });
  }

  /*
   * Callers naturally pass `{ latitude, longitude }` built inline, which would
   * be a new object every render and re-trigger the measurement effect forever.
   * Depending on the two numbers instead makes the hook safe to call that way.
   */
  const targetLatitude = targetCoordinates?.latitude ?? null;
  const targetLongitude = targetCoordinates?.longitude ?? null;
  const stableTargetCoordinates = useMemo<GeoCoordinates | null>(() => {
    if (targetLatitude === null || targetLongitude === null) {
      LoggerService.info(
        `${FILE_NAME}: stableTargetCoordinates: case carries no target coordinates`,
      );
      return null;
    }
    LoggerService.info(`${FILE_NAME}: stableTargetCoordinates: target coordinates stabilised`, {
      latitude: targetLatitude,
      longitude: targetLongitude,
    });
    return { latitude: targetLatitude, longitude: targetLongitude };
  }, [targetLatitude, targetLongitude]);

  const geocodingConfiguration = useMemo(() => {
    // The maps API key is a secret — only its presence is logged.
    LoggerService.info(`${FILE_NAME}: geocodingConfiguration: building geocoding configuration`, {
      providerName: settings.geocodingProvider,
      hasApiKey: settings.mapsApiKey.length > 0,
      hasBaseUrl: settings.mapsApiBaseUrl.length > 0,
    });
    return {
      providerName: settings.geocodingProvider,
      apiKey: settings.mapsApiKey,
      baseUrl: settings.mapsApiBaseUrl,
    };
  }, [settings.geocodingProvider, settings.mapsApiBaseUrl, settings.mapsApiKey]);

  const directionsConfiguration = useMemo<DirectionsProviderConfiguration | null>(() => {
    if (!settings.isDirectionsDistanceEnabled) {
      LoggerService.info(
        `${FILE_NAME}: directionsConfiguration: routing distance disabled — haversine only`,
      );
      return null;
    }
    LoggerService.info(`${FILE_NAME}: directionsConfiguration: routing distance enabled`, {
      providerName: settings.directionsProvider,
      hasApiKey: settings.mapsApiKey.length > 0,
      hasBaseUrl: settings.directionsApiBaseUrl.length > 0,
    });
    return {
      providerName: settings.directionsProvider,
      apiKey: settings.mapsApiKey,
      baseUrl: settings.directionsApiBaseUrl,
    };
  }, [
    settings.directionsApiBaseUrl,
    settings.directionsProvider,
    settings.isDirectionsDistanceEnabled,
    settings.mapsApiKey,
  ]);

  /** Coordinates from the payload, the earlier resolution, or the offline cache — never a guess. */
  const resolveCaseCoordinates = useCallback(async (): Promise<GeoCoordinates | null> => {
    if (stableTargetCoordinates !== null && !hasUsableGeoCoordinates(stableTargetCoordinates)) {
      /*
       * Present but rejected (the 0,0 sentinel or an out-of-range value) — the
       * address is the only remaining source, so say so rather than failing
       * silently. The rejected values themselves are logged where they are
       * read, in `case-repository.mapCaseCoordinates`.
       */
      LoggerService.warn(
        `${FILE_NAME}: resolveCaseCoordinates: case coordinates unusable — falling back to address`,
        { caseId },
      );
    }

    if (hasUsableGeoCoordinates(stableTargetCoordinates)) {
      LoggerService.info(`${FILE_NAME}: resolveCaseCoordinates: using case coordinates`, {
        caseId,
      });
      setIsCaseLocationFromCache(false);
      return stableTargetCoordinates;
    }

    if (resolvedCaseCoordinatesRef.current) {
      LoggerService.info(`${FILE_NAME}: resolveCaseCoordinates: reusing resolved coordinates`, {
        caseId,
      });
      return resolvedCaseCoordinatesRef.current;
    }

    if (address.trim().length === 0) {
      LoggerService.warn(
        `${FILE_NAME}: resolveCaseCoordinates: case has neither coordinates nor address`,
        {
          caseId,
        },
      );
      setUnresolvedReason('invalid_address');
      return null;
    }

    LoggerService.info(`${FILE_NAME}: resolveCaseCoordinates: geocoding case address`, { caseId });
    setStatus('resolving_case_location');
    try {
      const geocoded = await GeocodingService.resolveAddressCoordinates(
        address,
        geocodingConfiguration,
      );
      resolvedCaseCoordinatesRef.current = geocoded.coordinates;
      setIsCaseLocationFromCache(geocoded.source === 'cache');
      setUnresolvedReason(null);
      LoggerService.info(`${FILE_NAME}: resolveCaseCoordinates: address resolved`, {
        caseId,
        source: geocoded.source,
      });
      return geocoded.coordinates;
    } catch (error: unknown) {
      const reason: GeocodingFailureReason = isGeocodingFailedError(error)
        ? error.reason
        : 'provider_error';
      LoggerService.error(`${FILE_NAME}: resolveCaseCoordinates: address could not be resolved`, {
        caseId,
        reason,
      });
      setUnresolvedReason(reason);
      return null;
    }
  }, [address, caseId, geocodingConfiguration, stableTargetCoordinates]);

  const measure = useCallback(async (): Promise<void> => {
    measurementIdRef.current += 1;
    const measurementId = measurementIdRef.current;
    const isStale = (): boolean => {
      const stale = measurementId !== measurementIdRef.current;
      if (stale) {
        LoggerService.info(`${FILE_NAME}: isStale: measurement superseded — discarding result`, {
          caseId,
          measurementId,
        });
      }
      return stale;
    };

    LoggerService.info(`${FILE_NAME}: measure: starting measurement`, {
      caseId,
      measurementId,
      isEnabled,
    });

    if (!isEnabled) {
      LoggerService.info(`${FILE_NAME}: measure: disabled — case detail not loaded yet`, {
        caseId,
      });
      setStatus('idle');
      return;
    }

    /*
     * Read live rather than from the closure: a measurement started before the
     * configuration arrived (or one queued behind a retry that re-fetched it)
     * must judge against the current radius, not a captured `null`.
     */
    const configuration = getGeoFenceConfiguration();
    if (!configuration) {
      LoggerService.error(`${FILE_NAME}: measure: geo-fence configuration unavailable`, { caseId });
      setStatus('configuration_unavailable');
      return;
    }
    LoggerService.info(`${FILE_NAME}: measure: judging against live configuration`, {
      caseId,
      radiusMeters: configuration.geoFenceRadiusMeters,
      locationRetryCount: configuration.locationRetryCount,
    });

    /*
     * The case location is resolved before the device fix is required because
     * the two are independent: finding where the *case* is never depends on
     * where the *device* is. For a case that carries coordinates this returns
     * immediately; for one that carries only an address it means the lookup
     * overlaps the GPS acquisition instead of queueing behind it. Either way
     * the resolved location is on screen as early as it can be.
     */
    const targetPoint = await resolveCaseCoordinates();
    if (isStale()) {
      return;
    }
    if (!targetPoint) {
      LoggerService.warn(`${FILE_NAME}: measure: case location unresolved — cannot measure`, {
        caseId,
      });
      setStatus('case_location_unresolved');
      return;
    }
    LoggerService.info(`${FILE_NAME}: measure: case location known`, {
      caseId,
      latitude: targetPoint.latitude,
      longitude: targetPoint.longitude,
    });
    setCaseCoordinates(targetPoint);

    // The app-wide banner already tells the user what to fix; the section just
    // waits rather than showing a second, competing message.
    const { status: readinessStatus, location: deviceLocation } = useLocationStore.getState();
    if (readinessStatus !== 'ready' || !deviceLocation) {
      LoggerService.info(`${FILE_NAME}: measure: device location not ready`, {
        caseId,
        readinessStatus,
      });
      setStatus('awaiting_location');
      return;
    }

    LoggerService.info(`${FILE_NAME}: measure: device location ready — measuring distance`, {
      caseId,
      isMockLocation: deviceLocation.isMockLocation,
      accuracyMeters: deviceLocation.accuracyMeters,
      isRoutingDistanceEnabled: directionsConfiguration !== null,
    });
    setStatus('measuring');
    try {
      const distance = await DistanceService.measureDistance(
        { from: deviceLocation, to: targetPoint },
        directionsConfiguration ? { directionsConfiguration } : {},
      );
      if (isStale()) {
        return;
      }

      const evaluation = evaluateGeoFence({
        distanceMeters: distance.distanceMeters,
        radiusMeters: configuration.geoFenceRadiusMeters,
        distanceMethod: distance.distanceMethod,
      });
      LoggerService.info(`${FILE_NAME}: measure: geo-fence evaluated`, {
        caseId,
        distanceMeters: Math.round(evaluation.distanceMeters),
        radiusMeters: evaluation.radiusMeters,
        distanceMethod: evaluation.distanceMethod,
        isWithinFence: evaluation.isWithinFence,
      });

      setDistanceMeters(evaluation.distanceMeters);
      setDistanceMethod(evaluation.distanceMethod);
      setStatus(evaluation.isWithinFence ? 'inside' : 'outside');
    } catch (error: unknown) {
      // Reachable only if the local calculation itself fails, which means the
      // coordinates were unusable rather than the network being down.
      LoggerService.error(`${FILE_NAME}: measure: distance calculation failed`, {
        caseId,
        message: error instanceof Error ? error.message : String(error),
      });
      if (!isStale()) {
        setStatus('error');
      }
    }
  }, [caseId, directionsConfiguration, isEnabled, resolveCaseCoordinates]);

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: useCaseGeoFence: (re)running geo-fence check`, {
      caseId,
      isEnabled,
      locationStatus,
    });
    void measure();
    // `radiusMeters`/`locationRetryCount` are dependencies even though
    // `measure` reads them live: their arrival is what makes a previously
    // unconfigured check worth re-running.
  }, [caseId, isEnabled, locationRetryCount, locationStatus, measure, radiusMeters]);

  /**
   * "Recalculate Distance": takes a *new* GPS fix first — the field executive
   * has usually walked closer — then re-measures. Each press spends one of the
   * server-configured attempts.
   */
  const recalculate = useCallback(async (): Promise<void> => {
    LoggerService.info(`${FILE_NAME}: recalculate: recalculating distance`, {
      caseId,
      attemptCount: attemptCount + 1,
    });
    setAttemptCount((previousCount) => previousCount + 1);

    if (radiusMeters === null || locationRetryCount === null) {
      // The retry doubles as the recovery path for a configuration that never
      // arrived (a failed post-login fetch, or a cold start offline): fetch it
      // again rather than leaving the case permanently unopenable.
      LoggerService.info(`${FILE_NAME}: recalculate: reloading missing geo-fence configuration`, {
        caseId,
      });
      await reloadReferenceData();
      LoggerService.info(`${FILE_NAME}: recalculate: reference data reload finished`, { caseId });
    } else {
      LoggerService.info(`${FILE_NAME}: recalculate: configuration already present`, {
        caseId,
        radiusMeters,
        locationRetryCount,
      });
    }

    LoggerService.info(`${FILE_NAME}: recalculate: re-evaluating device location readiness`, {
      caseId,
    });
    await evaluateLocationReadiness();
    await measure();
    LoggerService.info(`${FILE_NAME}: recalculate: finished`, { caseId });
  }, [
    attemptCount,
    caseId,
    evaluateLocationReadiness,
    locationRetryCount,
    measure,
    radiusMeters,
    reloadReferenceData,
  ]);

  const isBlockedByGeoFence =
    status === 'outside' || status === 'case_location_unresolved' || status === 'error';

  /**
   * Offered only once the retry budget is spent, and never as a way around a
   * device problem: a missing permission, a mocked location or absent
   * configuration must be fixed, not consented away.
   */
  const canForceProceed =
    isBlockedByGeoFence && locationRetryCount !== null && attemptCount >= locationRetryCount;

  LoggerService.info(`${FILE_NAME}: useCaseGeoFence: gate resolved`, {
    caseId,
    status,
    isBlockedByGeoFence,
    canForceProceed,
    attemptCount,
    locationRetryCount,
    hasBypassConsent: bypassConsent !== null,
    distanceMeters: distanceMeters === null ? null : Math.round(distanceMeters),
    radiusMeters,
  });

  const confirmForceProceed = useCallback((): void => {
    if (!canForceProceed || radiusMeters === null) {
      LoggerService.warn(`${FILE_NAME}: confirmForceProceed: rejected — not eligible to bypass`, {
        caseId,
        attemptCount,
      });
      return;
    }

    LoggerService.warn(
      `${FILE_NAME}: confirmForceProceed: user consented to proceed without distance`,
      {
        caseId,
        attemptCount,
      },
    );
    grantBypassConsent({
      caseId,
      consentedAtIso: new Date().toISOString(),
      lastDistanceMeters: distanceMeters,
      radiusMeters,
      attemptCount,
    });
  }, [attemptCount, canForceProceed, caseId, distanceMeters, grantBypassConsent, radiusMeters]);

  const remainingAttempts =
    locationRetryCount === null ? 0 : Math.max(locationRetryCount - attemptCount, 0);

  LoggerService.info(`${FILE_NAME}: useCaseGeoFence: remaining retry attempts resolved`, {
    caseId,
    remainingAttempts,
    isCaseContentUnlocked: status === 'inside' || bypassConsent !== null,
  });

  return {
    status,
    isCaseContentUnlocked: status === 'inside' || bypassConsent !== null,
    isBusy: status === 'resolving_case_location' || status === 'measuring',
    distanceMeters,
    distanceMethod,
    radiusMeters,
    caseCoordinates,
    isCaseLocationFromCache,
    unresolvedReason,
    attemptCount,
    remainingAttempts,
    canForceProceed,
    bypassConsent,
    recalculate,
    confirmForceProceed,
  };
}
