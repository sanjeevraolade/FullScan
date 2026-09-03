import type { GeoCoordinates } from '@/core/types';

/**
 * Which strategy produced a distance.
 *
 * `'local'` is the Haversine straight-line calculation — offline, free,
 * deterministic, and the only method a geo-fence decision may rest on.
 * `'directions'` is route/travel distance from a routing provider and is
 * informational.
 */
export type DistanceMethod = 'local' | 'directions';

export interface DistanceResult {
  readonly distanceMeters: number;
  readonly distanceMethod: DistanceMethod;
  readonly calculatedAt: Date;
  /** Present only for `'directions'` results. */
  readonly durationSeconds: number | null;
}

export interface DistanceRequest {
  readonly from: GeoCoordinates;
  readonly to: GeoCoordinates;
}

export interface DirectionsProviderConfiguration {
  readonly providerName: string;
  readonly apiKey: string;
  /** Empty means "use the provider's own default endpoint". */
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}
