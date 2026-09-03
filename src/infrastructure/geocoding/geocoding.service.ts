import { LoggerService } from '@/infrastructure/logger';
import { ConnectivityService } from '@/infrastructure/networking';
import { KeyValueStorageService } from '@/infrastructure/storage';

import { GeocodingFailedError } from './geocoding.errors';
import { GoogleGeocodingProvider } from './google-geocoding.provider';
import type { IGeocodingProvider } from './geocoding-provider.interface';
import type { GeocodedCoordinates, GeocodingProviderConfiguration } from './geocoding.types';

const FILE_NAME = 'geocoding.service.ts';

/**
 * Versioned so a change in what we persist invalidates old entries instead of
 * being mis-parsed.
 */
const CACHE_KEY_PREFIX = 'geocoding:v1:';

/**
 * Every provider this build can use, keyed by the id that
 * `mobileAppSettings.geocoding_provider` carries. Swapping vendors is a
 * server-side setting change plus one entry here — no call site changes.
 */
const providerRegistry = new Map<string, IGeocodingProvider>([
  [GoogleGeocodingProvider.name, GoogleGeocodingProvider],
]);

/**
 * Registers (or replaces) a provider. Exported for the vendor swap the product
 * spec anticipates, and for tests that need a deterministic provider.
 */
export function registerGeocodingProvider(provider: IGeocodingProvider): void {
  LoggerService.info(`${FILE_NAME}: registerGeocodingProvider: provider registered`, {
    providerName: provider.name,
  });
  providerRegistry.set(provider.name, provider);
}

/**
 * Address text varies by whitespace and case between payloads; without
 * normalizing, the same address would be geocoded (and billed) repeatedly.
 */
function toCacheKey(providerName: string, address: string): string {
  // The address is candidate PII and ends up inside the key — log its size only.
  LoggerService.info(`${FILE_NAME}: toCacheKey: building cache key`, {
    providerName,
    addressLength: address.length,
  });
  const normalizedAddress = address.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${CACHE_KEY_PREFIX}${providerName}:${normalizedAddress}`;
}

function readCachedCoordinates(providerName: string, address: string): GeocodedCoordinates | null {
  LoggerService.info(`${FILE_NAME}: readCachedCoordinates: reading cached coordinates`, {
    providerName,
  });
  const cached = KeyValueStorageService.getObject<GeocodedCoordinates>(
    toCacheKey(providerName, address),
  );
  if (!cached) {
    LoggerService.warn(`${FILE_NAME}: readCachedCoordinates: cache miss`, { providerName });
    return null;
  }

  LoggerService.info(`${FILE_NAME}: readCachedCoordinates: cache hit`, {
    providerName: cached.providerName,
    resolvedAtIso: cached.resolvedAtIso,
  });
  return { ...cached, source: 'cache' };
}

function writeCachedCoordinates(
  providerName: string,
  address: string,
  resolved: GeocodedCoordinates,
): void {
  LoggerService.info(`${FILE_NAME}: writeCachedCoordinates: caching resolved coordinates`, {
    providerName,
  });
  KeyValueStorageService.setObject(toCacheKey(providerName, address), resolved);
}

/**
 * Turns a postal address into coordinates.
 *
 * Cache first — which is what makes an address-only case usable offline once
 * it has been resolved even once. A cache miss with no network throws
 * `offline` rather than guessing a location; the app never invents
 * coordinates for an unresolved address.
 */
async function resolveAddressCoordinates(
  address: string,
  configuration: GeocodingProviderConfiguration,
): Promise<GeocodedCoordinates> {
  // Address text is candidate PII — log that a resolution was requested, never the address.
  LoggerService.info(`${FILE_NAME}: resolveAddressCoordinates: resolving address coordinates`, {
    providerName: configuration.providerName,
    addressLength: address.length,
  });

  const trimmedAddress = address.trim();
  if (trimmedAddress.length === 0) {
    LoggerService.warn(`${FILE_NAME}: resolveAddressCoordinates: blank address`);
    throw new GeocodingFailedError('invalid_address', 'address is empty');
  }

  const provider = providerRegistry.get(configuration.providerName);
  if (!provider) {
    LoggerService.error(`${FILE_NAME}: resolveAddressCoordinates: unknown provider configured`, {
      providerName: configuration.providerName,
    });
    throw new GeocodingFailedError(
      'not_configured',
      'configured geocoding provider is not available',
    );
  }

  const cached = readCachedCoordinates(provider.name, trimmedAddress);
  if (cached) {
    LoggerService.info(`${FILE_NAME}: resolveAddressCoordinates: serving cached coordinates`, {
      providerName: provider.name,
    });
    return cached;
  }

  if (!provider.isConfigured(configuration)) {
    LoggerService.error(`${FILE_NAME}: resolveAddressCoordinates: provider is not configured`, {
      providerName: provider.name,
    });
    throw new GeocodingFailedError('not_configured', 'geocoding provider has no credentials');
  }

  if (!(await ConnectivityService.isConnected())) {
    LoggerService.warn(
      `${FILE_NAME}: resolveAddressCoordinates: offline and no cached coordinates`,
    );
    throw new GeocodingFailedError(
      'offline',
      'offline with no cached coordinates for this address',
    );
  }

  const geocoded = await provider.geocodeAddress(trimmedAddress, configuration);
  if (!geocoded) {
    LoggerService.warn(`${FILE_NAME}: resolveAddressCoordinates: provider found no match`, {
      providerName: provider.name,
    });
    throw new GeocodingFailedError('not_found', 'address could not be matched');
  }

  const resolved: GeocodedCoordinates = {
    coordinates: geocoded.coordinates,
    source: 'provider',
    formattedAddress: geocoded.formattedAddress,
    resolvedAtIso: new Date().toISOString(),
    providerName: provider.name,
  };
  writeCachedCoordinates(provider.name, trimmedAddress, resolved);
  LoggerService.info(`${FILE_NAME}: resolveAddressCoordinates: address resolved by provider`, {
    providerName: provider.name,
    source: resolved.source,
  });
  return resolved;
}

/** Drops every cached address→coordinates entry (e.g. on logout). */
function clearCache(): void {
  LoggerService.info(`${FILE_NAME}: clearCache: clearing the geocoding cache`);
  const keys = KeyValueStorageService.getAllKeys().filter((key) =>
    key.startsWith(CACHE_KEY_PREFIX),
  );
  LoggerService.info(`${FILE_NAME}: clearCache: dropping cached coordinates`, {
    count: keys.length,
  });
  keys.forEach((key) => KeyValueStorageService.remove(key));
}

export interface IGeocodingService {
  resolveAddressCoordinates(
    address: string,
    configuration: GeocodingProviderConfiguration,
  ): Promise<GeocodedCoordinates>;
  clearCache(): void;
}

export const GeocodingService: IGeocodingService = { resolveAddressCoordinates, clearCache };
