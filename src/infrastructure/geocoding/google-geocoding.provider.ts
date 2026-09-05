import axios from 'axios';

import type { GeoCoordinates } from '@/core/types';
import { LoggerService } from '@/infrastructure/logger';
import { isValidGeoCoordinates } from '@/core/utils';

import { GeocodingFailedError } from './geocoding.errors';
import type {
  GeocodedAddress,
  IGeocodingProvider,
  ReverseGeocodedAddress,
} from './geocoding-provider.interface';
import type { GeocodingProviderConfiguration } from './geocoding.types';

const FILE_NAME = 'google-geocoding.provider.ts';

export const GOOGLE_GEOCODING_PROVIDER_NAME = 'google';

const DEFAULT_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Decimal places kept when sending a point to Google. Six is ~0.1 m — well
 * inside GPS error, and it stops float noise from turning one physical spot
 * into endlessly different request URLs.
 */
const REQUEST_COORDINATE_DECIMAL_PLACES = 6;

/** Google's documented `status` values, split by how the app must react. */
const STATUS_OK = 'OK';
const STATUS_ZERO_RESULTS = 'ZERO_RESULTS';

interface GoogleGeocodeLocation {
  readonly lat?: number;
  readonly lng?: number;
}

interface GoogleGeocodeResult {
  readonly formatted_address?: string;
  readonly geometry?: { readonly location?: GoogleGeocodeLocation };
}

interface GoogleGeocodeResponse {
  readonly status?: string;
  readonly results?: readonly GoogleGeocodeResult[];
}

function isConfigured(configuration: GeocodingProviderConfiguration): boolean {
  // Never log the key itself — only whether one is present.
  const hasApiKey = configuration.apiKey.trim().length > 0;
  LoggerService.info(`${FILE_NAME}: isConfigured: provider configuration checked`, { hasApiKey });
  return hasApiKey;
}

/**
 * Runs one Geocoding API call. Both directions are the same endpoint with a
 * different query parameter (`address` vs `latlng`), so the transport, the
 * timeout and the axios-error-to-`GeocodingFailureReason` mapping live here
 * once.
 *
 * Returns `null` for `ZERO_RESULTS` — the one status that means "the answer is
 * genuinely nothing" rather than "try again" — and the matched results
 * otherwise.
 */
async function requestGeocode(
  queryParams: Readonly<Record<string, string>>,
  configuration: GeocodingProviderConfiguration,
): Promise<readonly GoogleGeocodeResult[] | null> {
  LoggerService.info(`${FILE_NAME}: requestGeocode: calling the geocoding endpoint`, {
    // The parameter *values* are PII (address text / the user's position) — the
    // key names say which direction this was without leaking either.
    queryKeys: Object.keys(queryParams).join(','),
  });

  let response;
  try {
    response = await axios.get<GoogleGeocodeResponse>(
      configuration.baseUrl.trim() || DEFAULT_BASE_URL,
      {
        params: { ...queryParams, key: configuration.apiKey },
        timeout: configuration.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
    );
  } catch (error: unknown) {
    const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
    const isOffline = axios.isAxiosError(error) && error.response === undefined && !isTimeout;
    const reason = isTimeout ? 'timeout' : isOffline ? 'offline' : 'provider_error';
    LoggerService.error(`${FILE_NAME}: requestGeocode: request failed`, { reason });
    throw new GeocodingFailedError(reason, 'geocoding request failed');
  }

  const { status, results } = response.data;
  // Never log the response body — it can echo the request URL (and API key) back.
  LoggerService.info(`${FILE_NAME}: requestGeocode: provider responded`, {
    status,
    resultCount: results?.length ?? 0,
  });

  if (status === STATUS_ZERO_RESULTS) {
    LoggerService.warn(`${FILE_NAME}: requestGeocode: provider has no match`);
    return null;
  }

  if (status !== STATUS_OK) {
    // Covers OVER_QUERY_LIMIT / REQUEST_DENIED / INVALID_REQUEST — all of
    // which are billing or configuration problems on our side, and none of
    // which may block a geo-fence decision (see `DistanceService`).
    LoggerService.error(`${FILE_NAME}: requestGeocode: provider rejected the request`, { status });
    throw new GeocodingFailedError(
      'provider_error',
      `geocoding provider status ${status ?? 'unknown'}`,
    );
  }

  return results ?? [];
}

async function geocodeAddress(
  address: string,
  configuration: GeocodingProviderConfiguration,
): Promise<GeocodedAddress | null> {
  // Address text is candidate PII — log that a request happened, never the address.
  LoggerService.info(`${FILE_NAME}: geocodeAddress: resolving address`, {
    addressLength: address.length,
  });

  const results = await requestGeocode({ address }, configuration);
  if (!results) {
    LoggerService.warn(`${FILE_NAME}: geocodeAddress: address has no match`);
    return null;
  }

  const location = results[0]?.geometry?.location;
  const coordinates = {
    latitude: location?.lat ?? Number.NaN,
    longitude: location?.lng ?? Number.NaN,
  };

  if (!isValidGeoCoordinates(coordinates)) {
    LoggerService.error(`${FILE_NAME}: geocodeAddress: provider returned no usable coordinates`);
    throw new GeocodingFailedError('provider_error', 'geocoding provider returned no coordinates');
  }

  LoggerService.info(`${FILE_NAME}: geocodeAddress: address resolved`);
  return { coordinates, formattedAddress: results[0]?.formatted_address ?? null };
}

async function reverseGeocodeCoordinates(
  coordinates: GeoCoordinates,
  configuration: GeocodingProviderConfiguration,
): Promise<ReverseGeocodedAddress | null> {
  // The point is the field executive's own position — log that a request
  // happened, never where they are.
  LoggerService.info(`${FILE_NAME}: reverseGeocodeCoordinates: resolving coordinates`);

  const latlng = [
    coordinates.latitude.toFixed(REQUEST_COORDINATE_DECIMAL_PLACES),
    coordinates.longitude.toFixed(REQUEST_COORDINATE_DECIMAL_PLACES),
  ].join(',');

  const results = await requestGeocode({ latlng }, configuration);
  if (!results) {
    LoggerService.warn(`${FILE_NAME}: reverseGeocodeCoordinates: point has no mapped address`);
    return null;
  }

  // Google orders results most-specific first, which is the one a watermark
  // wants; anything coarser (city, country) is a worse label, not a fallback.
  const formattedAddress = results[0]?.formatted_address?.trim() ?? '';
  if (formattedAddress.length === 0) {
    LoggerService.error(
      `${FILE_NAME}: reverseGeocodeCoordinates: provider returned no usable address`,
    );
    throw new GeocodingFailedError('provider_error', 'geocoding provider returned no address');
  }

  LoggerService.info(`${FILE_NAME}: reverseGeocodeCoordinates: coordinates resolved`);
  return { formattedAddress };
}

/**
 * Google Geocoding API implementation. Nothing outside this file knows the
 * vendor — see `IGeocodingProvider` for why.
 */
export const GoogleGeocodingProvider: IGeocodingProvider = {
  name: GOOGLE_GEOCODING_PROVIDER_NAME,
  isConfigured,
  geocodeAddress,
  reverseGeocodeCoordinates,
};
