import { LoggerService } from '@/infrastructure/logger';

import { DirectionsDistanceService } from './directions-distance.service';
import { LocalDistanceService } from './local-distance.service';
import type {
  DirectionsProviderConfiguration,
  DistanceRequest,
  DistanceResult,
} from './distance.types';

const FILE_NAME = 'distance.service.ts';

export interface DistanceOptions {
  /**
   * Route distance is attempted only when this is supplied *and* the provider
   * is configured. Omit it — or leave the provider unconfigured — and the
   * result is always the local calculation.
   */
  readonly directionsConfiguration?: DirectionsProviderConfiguration;
}

export interface IDistanceFacade {
  measureDistance(request: DistanceRequest, options?: DistanceOptions): Promise<DistanceResult>;
  measureLocalDistance(request: DistanceRequest): Promise<DistanceResult>;
}

/**
 * The distance abstraction the app actually calls.
 *
 * Fallback policy, which is a hard requirement rather than an optimization:
 * whenever both coordinates are known, a distance is *always* produced by the
 * local Haversine calculation. A route-distance attempt can fail, time out,
 * be rate-limited, be unbilled, or find no network — none of which may block a
 * geo-fence decision, so every one of those outcomes is swallowed and the
 * local result is returned instead. The caller learns which strategy answered
 * from `distanceMethod`, and nothing in the UI or business rules branches on
 * the provider.
 */
async function measureDistance(
  request: DistanceRequest,
  options: DistanceOptions = {},
): Promise<DistanceResult> {
  LoggerService.info(`${FILE_NAME}: measureDistance: measuring distance between coordinates`);
  const localResult = await LocalDistanceService.calculateDistance(request);
  const { directionsConfiguration } = options;

  if (!directionsConfiguration) {
    LoggerService.info(`${FILE_NAME}: measureDistance: route distance not requested`, {
      distanceMethod: localResult.distanceMethod,
    });
    return localResult;
  }

  if (!DirectionsDistanceService.isConfigured(directionsConfiguration)) {
    LoggerService.info(`${FILE_NAME}: measureDistance: directions provider not configured`, {
      providerName: directionsConfiguration.providerName,
      distanceMethod: localResult.distanceMethod,
    });
    return localResult;
  }

  try {
    const routeResult = await DirectionsDistanceService.calculateRouteDistance(
      request,
      directionsConfiguration,
    );
    LoggerService.info(`${FILE_NAME}: measureDistance: using route distance`, {
      distanceMethod: routeResult.distanceMethod,
    });
    return routeResult;
  } catch (error: unknown) {
    LoggerService.warn(
      `${FILE_NAME}: measureDistance: route distance failed, falling back to local calculation`,
      { message: error instanceof Error ? error.message : String(error) },
    );
    return localResult;
  }
}

/** The offline path, stated explicitly for callers that must not touch the network. */
async function measureLocalDistance(request: DistanceRequest): Promise<DistanceResult> {
  LoggerService.info(`${FILE_NAME}: measureLocalDistance: local-only distance requested`);
  return LocalDistanceService.calculateDistance(request);
}

export const DistanceService: IDistanceFacade = { measureDistance, measureLocalDistance };
