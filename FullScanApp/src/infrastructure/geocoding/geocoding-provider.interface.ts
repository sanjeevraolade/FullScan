import type { GeoCoordinates } from '@/core/types';

import type { GeocodingProviderConfiguration } from './geocoding.types';

export interface GeocodedAddress {
  readonly coordinates: GeoCoordinates;
  readonly formattedAddress: string | null;
}

export interface ReverseGeocodedAddress {
  readonly formattedAddress: string;
}

/**
 * One geocoding vendor.
 *
 * Google is the initial implementation, but billing/cost may force a change,
 * so nothing above this interface may mention Google: providers are selected
 * by id from `mobileAppSettings.geocoding_provider` and registered in
 * `geocoding.service.ts`. Adding a vendor means adding one file here.
 *
 * Both directions go through the vendor's own HTTP API deliberately — never
 * the device's built-in geocoder. An OS geocoder answers differently per
 * handset (and on Android is silently unavailable without Play Services, where
 * "rate limited" is indistinguishable from "no such address"), which would
 * make a geo-fence verdict unreproducible in an audit.
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
  /**
   * Resolves a point to a postal address. Returns `null` when the provider is
   * certain nothing is mapped there (mid-ocean, unmapped area) so the caller
   * can label it as such instead of retrying, and throws
   * `GeocodingFailedError` for anything transient.
   */
  reverseGeocodeCoordinates(
    coordinates: GeoCoordinates,
    configuration: GeocodingProviderConfiguration,
  ): Promise<ReverseGeocodedAddress | null>;
}
