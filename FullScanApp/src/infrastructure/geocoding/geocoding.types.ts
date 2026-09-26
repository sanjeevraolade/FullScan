import type { GeoCoordinates } from '@/core/types';

/** How a geocoding result was obtained — the same either direction. */
export type GeocodingResultSource = 'provider' | 'cache';

export interface GeocodedCoordinates {
  readonly coordinates: GeoCoordinates;
  readonly source: GeocodingResultSource;
  /** What the provider echoed back, for the audit trail. Never shown as the case address. */
  readonly formattedAddress: string | null;
  readonly resolvedAtIso: string;
  /** Provider id that produced the result (`'cache'` entries keep the original). */
  readonly providerName: string;
}

/**
 * A point turned back into a postal address — the reverse of
 * `GeocodedCoordinates`.
 *
 * Descriptive only. The coordinates remain the evidence; this is the
 * human-readable label shown next to them (watermark bar, report header), and
 * it is never fed back into a geo-fence decision.
 */
export interface ResolvedAddress {
  readonly formattedAddress: string;
  readonly source: GeocodingResultSource;
  readonly resolvedAtIso: string;
  readonly providerName: string;
}

/** Why an address could not be turned into coordinates, or the other way round. */
export type GeocodingFailureReason =
  | 'not_configured'
  | 'offline'
  | 'not_found'
  | 'provider_error'
  | 'timeout'
  | 'invalid_address'
  | 'invalid_coordinates';

export interface GeocodingProviderConfiguration {
  readonly providerName: string;
  readonly apiKey: string;
  /** Empty means "use the provider's own default endpoint". */
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}
