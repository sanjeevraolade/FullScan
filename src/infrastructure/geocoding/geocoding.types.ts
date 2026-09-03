import type { GeoCoordinates } from '@/core/types';

/** How a case's coordinates were obtained. */
export type GeocodedCoordinatesSource = 'provider' | 'cache';

export interface GeocodedCoordinates {
  readonly coordinates: GeoCoordinates;
  readonly source: GeocodedCoordinatesSource;
  /** What the provider echoed back, for the audit trail. Never shown as the case address. */
  readonly formattedAddress: string | null;
  readonly resolvedAtIso: string;
  /** Provider id that produced the result (`'cache'` entries keep the original). */
  readonly providerName: string;
}

/** Why an address could not be turned into coordinates. */
export type GeocodingFailureReason =
  | 'not_configured'
  | 'offline'
  | 'not_found'
  | 'provider_error'
  | 'timeout'
  | 'invalid_address';

export interface GeocodingProviderConfiguration {
  readonly providerName: string;
  readonly apiKey: string;
  /** Empty means "use the provider's own default endpoint". */
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}
