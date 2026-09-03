import type { GeoCoordinates } from '@/core/types';

import type { GeocodingProviderConfiguration } from './geocoding.types';

export interface GeocodedAddress {
  readonly coordinates: GeoCoordinates;
  readonly formattedAddress: string | null;
}

/**
 * One geocoding vendor.
 *
 * Google is the initial implementation, but billing/cost may force a change,
 * so nothing above this interface may mention Google: providers are selected
 * by id from `mobileAppSettings.geocoding_provider` and registered in
 * `geocoding.service.ts`. Adding a vendor means adding one file here.
 */
export interface IGeocodingProvider {
  /** Matches the `geocoding_provider` setting value. */
  readonly name: string;
  /** `false` when the provider has no usable credentials/endpoint configured. */
  isConfigured(configuration: GeocodingProviderConfiguration): boolean;
  /**
   * Resolves a postal address. Returns `null` when the provider is certain the
   * address has no match (so the caller can say so instead of retrying), and
   * throws `GeocodingFailedError` for anything transient.
   */
  geocodeAddress(
    address: string,
    configuration: GeocodingProviderConfiguration,
  ): Promise<GeocodedAddress | null>;
}
