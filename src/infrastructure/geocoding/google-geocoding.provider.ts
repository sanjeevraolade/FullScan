import axios from 'axios';

import { LoggerService } from '@/infrastructure/logger';
import { isValidGeoCoordinates } from '@/core/utils';

import { GeocodingFailedError } from './geocoding.errors';
import type { GeocodedAddress, IGeocodingProvider } from './geocoding-provider.interface';
import type { GeocodingProviderConfiguration } from './geocoding.types';

const FILE_NAME = 'google-geocoding.provider.ts';

export const GOOGLE_GEOCODING_PROVIDER_NAME = 'google';

const DEFAULT_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DEFAULT_TIMEOUT_MS = 10000;

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

async function geocodeAddress(
  address: string,
  configuration: GeocodingProviderConfiguration,
): Promise<GeocodedAddress | null> {
  // Address text is candidate PII — log that a request happened, never the address.
  LoggerService.info(`${FILE_NAME}: geocodeAddress: resolving address`, {
    addressLength: address.length,
  });

  let response;
  try {
    response = await axios.get<GoogleGeocodeResponse>(
      configuration.baseUrl.trim() || DEFAULT_BASE_URL,
      {
        params: { address, key: configuration.apiKey },
        timeout: configuration.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
    );
  } catch (error: unknown) {
    const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
    const isOffline = axios.isAxiosError(error) && error.response === undefined && !isTimeout;
    const reason = isTimeout ? 'timeout' : isOffline ? 'offline' : 'provider_error';
    LoggerService.error(`${FILE_NAME}: geocodeAddress: request failed`, { reason });
    throw new GeocodingFailedError(reason, 'geocoding request failed');
  }

  const { status, results } = response.data;
  // Never log the response body — it can echo the request URL (and API key) back.
  LoggerService.info(`${FILE_NAME}: geocodeAddress: provider responded`, {
    status,
    resultCount: results?.length ?? 0,
  });

  if (status === STATUS_ZERO_RESULTS) {
    LoggerService.warn(`${FILE_NAME}: geocodeAddress: address has no match`);
    return null;
  }

  if (status !== STATUS_OK) {
    // Covers OVER_QUERY_LIMIT / REQUEST_DENIED / INVALID_REQUEST — all of
    // which are billing or configuration problems on our side, and none of
    // which may block a geo-fence decision (see `DistanceService`).
    LoggerService.error(`${FILE_NAME}: geocodeAddress: provider rejected the request`, { status });
    throw new GeocodingFailedError(
      'provider_error',
      `geocoding provider status ${status ?? 'unknown'}`,
    );
  }

  const location = results?.[0]?.geometry?.location;
  const coordinates = {
    latitude: location?.lat ?? Number.NaN,
    longitude: location?.lng ?? Number.NaN,
  };

  if (!isValidGeoCoordinates(coordinates)) {
    LoggerService.error(`${FILE_NAME}: geocodeAddress: provider returned no usable coordinates`);
    throw new GeocodingFailedError('provider_error', 'geocoding provider returned no coordinates');
  }

  LoggerService.info(`${FILE_NAME}: geocodeAddress: address resolved`);
  return { coordinates, formattedAddress: results?.[0]?.formatted_address ?? null };
}

/**
 * Google Geocoding API implementation. Nothing outside this file knows the
 * vendor — see `IGeocodingProvider` for why.
 */
export const GoogleGeocodingProvider: IGeocodingProvider = {
  name: GOOGLE_GEOCODING_PROVIDER_NAME,
  isConfigured,
  geocodeAddress,
};
