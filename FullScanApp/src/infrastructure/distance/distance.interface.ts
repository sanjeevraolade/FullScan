import type {
  DirectionsProviderConfiguration,
  DistanceMethod,
  DistanceRequest,
  DistanceResult,
} from './distance.types';

/**
 * One way of measuring the distance between two points. Callers depend on this
 * interface, never on a specific strategy, so the geo-fence rule cannot
 * accidentally acquire a network dependency.
 */
export interface IDistanceService {
  readonly method: DistanceMethod;
  calculateDistance(request: DistanceRequest): Promise<DistanceResult>;
}

/**
 * A routing vendor. Kept separate from `IDistanceService` because it needs
 * credentials and can fail — and because the vendor is expected to change.
 */
export interface IDirectionsDistanceService extends IDistanceService {
  isConfigured(configuration: DirectionsProviderConfiguration): boolean;
  calculateRouteDistance(
    request: DistanceRequest,
    configuration: DirectionsProviderConfiguration,
  ): Promise<DistanceResult>;
}
