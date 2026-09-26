import type { GeoCoordinates } from '@/core/types';
import { isValidGeoCoordinates } from '@/core/utils';
import { LoggerService } from '@/infrastructure/logger';
import { ConnectivityService } from '@/infrastructure/networking';
import { KeyValueStorageService } from '@/infrastructure/storage';

import { GeocodingFailedError } from './geocoding.errors';
import { GoogleGeocodingProvider } from './google-geocoding.provider';
import type { IGeocodingProvider } from './geocoding-provider.interface';
import type {
  GeocodedCoordinates,
  GeocodingProviderConfiguration,
  ResolvedAddress,
} from './geocoding.types';

const FILE_NAME = 'geocoding.service.ts';

/**
 * Versioned so a change in what we persist invalidates old entries instead of
 * being mis-parsed. The two directions cache under separate prefixes so an
 * address can never collide with a coordinate pair — `clearCache` drops both.
 */
const CACHE_KEY_PREFIX = 'geocoding:v1:';
const REVERSE_CACHE_KEY_PREFIX = 'geocoding-reverse:v1:';

/**
 * Decimal places a point is rounded to before it becomes a cache key — four is
 * ~11 m.
 *
 * A raw fix never repeats exactly, so caching on the exact pair would bill a
 * request per photo. Rounding to a grid means an executive standing at one
 * doorstep re-uses the address they already resolved. It costs nothing in
 * evidence terms: the exact coordinates are what gets recorded, this address is
 * only the label beside them.
 */
const REVERSE_CACHE_GRID_DECIMAL_PLACES = 4;

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
 * Resolves the configured provider, or fails with `not_configured` — a
 * `geocoding_provider` value this build has no implementation for is a
 * deployment mistake, not something the user can retry away.
 */
function requireProvider(configuration: GeocodingProviderConfiguration): IGeocodingProvider {
  const provider = providerRegistry.get(configuration.providerName);
  if (!provider) {
    LoggerService.error(`${FILE_NAME}: requireProvider: unknown provider configured`, {
      providerName: configuration.providerName,
    });
    throw new GeocodingFailedError(
      'not_configured',
      'configured geocoding provider is not available',
    );
  }

  LoggerService.info(`${FILE_NAME}: requireProvider: provider resolved`, {
    providerName: provider.name,
  });
  return provider;
}

/**
 * Guards the two conditions that must hold before any request is billed:
 * credentials exist, and there is a network to reach the vendor on. Called
 * only after the cache has already missed.
 */
async function requireReachableProvider(
  provider: IGeocodingProvider,
  configuration: GeocodingProviderConfiguration,
): Promise<void> {
  if (!provider.isConfigured(configuration)) {
    LoggerService.error(`${FILE_NAME}: requireReachableProvider: provider is not configured`, {
      providerName: provider.name,
    });
    throw new GeocodingFailedError('not_configured', 'geocoding provider has no credentials');
  }

  if (!(await ConnectivityService.isConnected())) {
    LoggerService.warn(`${FILE_NAME}: requireReachableProvider: offline with no cached result`, {
      providerName: provider.name,
    });
    throw new GeocodingFailedError('offline', 'offline with no cached geocoding result');
  }

  LoggerService.info(`${FILE_NAME}: requireReachableProvider: provider is reachable`, {
    providerName: provider.name,
  });
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

/** The reverse-direction key: the point rounded onto the grid above. */
function toReverseCacheKey(providerName: string, coordinates: GeoCoordinates): string {
  // The point is the user's position and ends up inside the key — never logged.
  LoggerService.info(`${FILE_NAME}: toReverseCacheKey: building reverse cache key`, {
    providerName,
  });
  const griddedLatitude = coordinates.latitude.toFixed(REVERSE_CACHE_GRID_DECIMAL_PLACES);
  const griddedLongitude = coordinates.longitude.toFixed(REVERSE_CACHE_GRID_DECIMAL_PLACES);
  return `${REVERSE_CACHE_KEY_PREFIX}${providerName}:${griddedLatitude},${griddedLongitude}`;
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

function readCachedAddress(
  providerName: string,
  coordinates: GeoCoordinates,
): ResolvedAddress | null {
  LoggerService.info(`${FILE_NAME}: readCachedAddress: reading cached address`, { providerName });
  const cached = KeyValueStorageService.getObject<ResolvedAddress>(
    toReverseCacheKey(providerName, coordinates),
  );
  if (!cached) {
    LoggerService.warn(`${FILE_NAME}: readCachedAddress: cache miss`, { providerName });
    return null;
  }

  LoggerService.info(`${FILE_NAME}: readCachedAddress: cache hit`, {
    providerName: cached.providerName,
    resolvedAtIso: cached.resolvedAtIso,
  });
  return { ...cached, source: 'cache' };
}

function writeCachedAddress(
  providerName: string,
  coordinates: GeoCoordinates,
  resolved: ResolvedAddress,
): void {
  LoggerService.info(`${FILE_NAME}: writeCachedAddress: caching resolved address`, {
    providerName,
  });
  KeyValueStorageService.setObject(toReverseCacheKey(providerName, coordinates), resolved);
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

  const provider = requireProvider(configuration);

  const cached = readCachedCoordinates(provider.name, trimmedAddress);
  if (cached) {
    LoggerService.info(`${FILE_NAME}: resolveAddressCoordinates: serving cached coordinates`, {
      providerName: provider.name,
    });
    return cached;
  }

  await requireReachableProvider(provider, configuration);

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

/**
 * Turns a point into a postal address — the label for a watermark or report
 * header, never an input to a geo-fence decision.
 *
 * Same cache-first, never-guess contract as the forward direction: callers get
 * a `GeocodingFailedError` they can branch on, and must be able to carry on
 * without an address (a photo is still valid evidence with coordinates alone,
 * and in the field it will often be captured offline at a point never seen
 * before).
 */
async function resolveCoordinatesAddress(
  coordinates: GeoCoordinates,
  configuration: GeocodingProviderConfiguration,
): Promise<ResolvedAddress> {
  // The point locates the field executive — log the attempt, never the position.
  LoggerService.info(`${FILE_NAME}: resolveCoordinatesAddress: resolving coordinates address`, {
    providerName: configuration.providerName,
  });

  if (!isValidGeoCoordinates(coordinates)) {
    LoggerService.warn(`${FILE_NAME}: resolveCoordinatesAddress: coordinates are not usable`);
    throw new GeocodingFailedError('invalid_coordinates', 'coordinates are out of range');
  }

  const provider = requireProvider(configuration);

  const cached = readCachedAddress(provider.name, coordinates);
  if (cached) {
    LoggerService.info(`${FILE_NAME}: resolveCoordinatesAddress: serving cached address`, {
      providerName: provider.name,
    });
    return cached;
  }

  await requireReachableProvider(provider, configuration);

  const reverseGeocoded = await provider.reverseGeocodeCoordinates(coordinates, configuration);
  if (!reverseGeocoded) {
    LoggerService.warn(`${FILE_NAME}: resolveCoordinatesAddress: provider found no match`, {
      providerName: provider.name,
    });
    throw new GeocodingFailedError('not_found', 'coordinates could not be matched');
  }

  const resolved: ResolvedAddress = {
    formattedAddress: reverseGeocoded.formattedAddress,
    source: 'provider',
    resolvedAtIso: new Date().toISOString(),
    providerName: provider.name,
  };
  writeCachedAddress(provider.name, coordinates, resolved);
  LoggerService.info(`${FILE_NAME}: resolveCoordinatesAddress: coordinates resolved by provider`, {
    providerName: provider.name,
    source: resolved.source,
  });
  return resolved;
}

/** Drops every cached geocoding entry, both directions (e.g. on logout). */
function clearCache(): void {
  LoggerService.info(`${FILE_NAME}: clearCache: clearing the geocoding cache`);
  const keys = KeyValueStorageService.getAllKeys().filter(
    (key) => key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(REVERSE_CACHE_KEY_PREFIX),
  );
  LoggerService.info(`${FILE_NAME}: clearCache: dropping cached geocoding entries`, {
    count: keys.length,
  });
  keys.forEach((key) => KeyValueStorageService.remove(key));
}

export interface IGeocodingService {
  resolveAddressCoordinates(
    address: string,
    configuration: GeocodingProviderConfiguration,
  ): Promise<GeocodedCoordinates>;
  resolveCoordinatesAddress(
    coordinates: GeoCoordinates,
    configuration: GeocodingProviderConfiguration,
  ): Promise<ResolvedAddress>;
  clearCache(): void;
}

export const GeocodingService: IGeocodingService = {
  resolveAddressCoordinates,
  resolveCoordinatesAddress,
  clearCache,
};
