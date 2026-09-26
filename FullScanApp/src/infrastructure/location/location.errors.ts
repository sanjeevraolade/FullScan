import { LoggerService } from '@/infrastructure/logger';

import type { LocationUnavailableReason } from './location.types';

const FILE_NAME = 'location.errors.ts';

/**
 * Thrown when the platform cannot produce a fix. Carries a normalized
 * `reason` so callers branch on the cause (turn on location services vs.
 * grant permission vs. move to open sky) instead of parsing platform
 * error codes or messages.
 */
export class LocationUnavailableError extends Error {
  readonly reason: LocationUnavailableReason;

  constructor(reason: LocationUnavailableReason, message: string) {
    super(message);
    this.name = 'LocationUnavailableError';
    this.reason = reason;
    LoggerService.warn(`${FILE_NAME}: LocationUnavailableError: constructed`, { reason });
  }
}

/** Narrowing helper — `instanceof` alone survives neither transpilation edge cases nor mocks. */
export function isLocationUnavailableError(error: unknown): error is LocationUnavailableError {
  const isMatch = error instanceof LocationUnavailableError;
  LoggerService.info(`${FILE_NAME}: isLocationUnavailableError: error type checked`, { isMatch });
  return isMatch;
}
