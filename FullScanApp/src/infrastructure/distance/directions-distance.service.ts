import axios from 'axios';

import { LoggerService } from '@/infrastructure/logger';

import type { IDirectionsDistanceService } from './distance.interface';
import type {
  DirectionsProviderConfiguration,
  DistanceRequest,
  DistanceResult,
} from './distance.types';

const FILE_NAME = 'directions-distance.service.ts';

export const GOOGLE_DIRECTIONS_PROVIDER_NAME = 'google';

const DEFAULT_BASE_URL = 'https://maps.googleapis.com/maps/api/directions/json';
/**
 * Deliberately short. A route distance is a nice-to-have shown next to the
 * geo-fence result, so it must never be what the field executive waits on.
 */
const DEFAULT_TIMEOUT_MS = 6000;
const STATUS_OK = 'OK';

interface GoogleDirectionsLeg {
  readonly distance?: { readonly value?: number };
  readonly duration?: { readonly value?: number };
}

interface GoogleDirectionsRoute {
  readonly legs?: readonly GoogleDirectionsLeg[];
}

interface GoogleDirectionsResponse {
  readonly status?: string;
  readonly routes?: readonly GoogleDirectionsRoute[];
}

function isConfigured(configuration: DirectionsProviderConfiguration): boolean {
  // Never log the key itself — only whether one is present.
  const hasApiKey = configuration.apiKey.trim().length > 0;
  LoggerService.info(`${FILE_NAME}: isConfigured: provider configuration checked`, {
    providerName: configuration.providerName,
    hasApiKey,
  });
  return hasApiKey;
}

function toLatLongParameter(latitude: number, longitude: number): string {
  LoggerService.info(`${FILE_NAME}: toLatLongParameter: formatting coordinate parameter`, {
    latitude,
    longitude,
  });
  return `${latitude},${longitude}`;
}

/**
 * Route/travel distance from the configured routing provider.
 *
 * Throws on any failure — and every caller is expected to swallow that and
 * fall back to `LocalDistanceService`. See `DistanceService`.
 */
async function calculateRouteDistance(
  request: DistanceRequest,
  configuration: DirectionsProviderConfiguration,
): Promise<DistanceResult> {
  LoggerService.info(`${FILE_NAME}: calculateRouteDistance: requesting route distance`, {
    providerName: configuration.providerName,
  });

  const response = await axios.get<GoogleDirectionsResponse>(
    configuration.baseUrl.trim() || DEFAULT_BASE_URL,
    {
      params: {
        origin: toLatLongParameter(request.from.latitude, request.from.longitude),
        destination: toLatLongParameter(request.to.latitude, request.to.longitude),
        key: configuration.apiKey,
      },
      timeout: configuration.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

  const { status, routes } = response.data;
  LoggerService.info(`${FILE_NAME}: calculateRouteDistance: provider responded`, {
    status,
    routeCount: routes?.length ?? 0,
  });
  if (status !== STATUS_OK) {
    LoggerService.warn(`${FILE_NAME}: calculateRouteDistance: provider rejected the request`, {
      status,
    });
    throw new Error(`directions provider status ${status ?? 'unknown'}`);
  }

  const legs = routes?.[0]?.legs ?? [];
  const distanceMeters = legs.reduce((total, leg) => total + (leg.distance?.value ?? 0), 0);
  const durationSeconds = legs.reduce((total, leg) => total + (leg.duration?.value ?? 0), 0);

  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    LoggerService.warn(`${FILE_NAME}: calculateRouteDistance: provider returned no usable route`);
    throw new Error('directions provider returned no usable route');
  }

  LoggerService.info(`${FILE_NAME}: calculateRouteDistance: route distance received`, {
    distanceMeters: Math.round(distanceMeters),
  });
  return {
    distanceMeters,
    distanceMethod: 'directions',
    calculatedAt: new Date(),
    durationSeconds: durationSeconds > 0 ? durationSeconds : null,
  };
}

/**
 * `calculateDistance` (the plain `IDistanceService` entry point) is
 * unavailable without configuration, so this service is always used through
 * `calculateRouteDistance` with an explicit configuration.
 */
async function calculateDistance(): Promise<DistanceResult> {
  LoggerService.warn(`${FILE_NAME}: calculateDistance: called without provider configuration`);
  throw new Error('directions distance requires a provider configuration');
}

export const DirectionsDistanceService: IDirectionsDistanceService = {
  method: 'directions',
  isConfigured,
  calculateDistance,
  calculateRouteDistance,
};
