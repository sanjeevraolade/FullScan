import { LoggerService } from '@/infrastructure/logger';

import type { GeocodingFailureReason } from './geocoding.types';

const FILE_NAME = 'geocoding.errors.ts';

/**
 * Thrown when an address cannot be resolved. Carries a normalized `reason`
 * so the UI can tell "connect to the internet and try again" apart from
 * "this address does not exist" — and so a provider swap never changes what
 * callers branch on.
 *
 * The message never carries provider response bodies (they can echo the API
 * key back in a URL).
 */
export class GeocodingFailedError extends Error {
  readonly reason: GeocodingFailureReason;

  constructor(reason: GeocodingFailureReason, message: string) {
    super(message);
    this.name = 'GeocodingFailedError';
    this.reason = reason;
    LoggerService.warn(`${FILE_NAME}: GeocodingFailedError: constructed`, { reason });
  }
}

export function isGeocodingFailedError(error: unknown): error is GeocodingFailedError {
  const isMatch = error instanceof GeocodingFailedError;
  LoggerService.info(`${FILE_NAME}: isGeocodingFailedError: error type checked`, { isMatch });
  return isMatch;
}
