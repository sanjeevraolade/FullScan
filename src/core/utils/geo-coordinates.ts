import type { GeoCoordinates } from '@/core/types';
import { LoggerService } from '@/infrastructure/logger';

/** Path-qualified: `src/core/types/geo-coordinates.ts` shares this basename. */
const FILE_NAME = 'core/utils/geo-coordinates.ts';

/**
 * The backend's `case_components.target_latitude/target_longitude` columns
 * default to `0` when the back office hasn't geocoded an assignment yet, so an
 * exact 0,0 pair is a "not set" sentinel rather than a real point in the Gulf
 * of Guinea. Treating it as usable would silently geo-fence every such case
 * against Null Island — see `hasUsableGeoCoordinates`.
 */
const UNSET_COORDINATE_TOLERANCE = 1e-9;
const LATITUDE_LIMIT_DEGREES = 90;
const LONGITUDE_LIMIT_DEGREES = 180;

/** True when both values are finite numbers inside the valid lat/long ranges. */
export function isValidGeoCoordinates(
  coordinates: GeoCoordinates | null | undefined,
): coordinates is GeoCoordinates {
  LoggerService.info(`${FILE_NAME}: isValidGeoCoordinates: entry`, {
    hasCoordinates: Boolean(coordinates),
  });

  if (!coordinates) {
    LoggerService.warn(`${FILE_NAME}: isValidGeoCoordinates: rejected — no coordinates supplied`);
    return false;
  }

  const { latitude, longitude } = coordinates;
  const isValid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= LATITUDE_LIMIT_DEGREES &&
    Math.abs(longitude) <= LONGITUDE_LIMIT_DEGREES;

  if (!isValid) {
    LoggerService.warn(
      `${FILE_NAME}: isValidGeoCoordinates: rejected — out of range or non-finite`,
      {
        latitude,
        longitude,
      },
    );
    return false;
  }

  LoggerService.info(`${FILE_NAME}: isValidGeoCoordinates: accepted`, { latitude, longitude });
  return isValid;
}

/**
 * True when a point is valid *and* is not the backend's 0,0 "not geocoded yet"
 * sentinel — i.e. safe to geo-fence against. Callers that get `false` must
 * resolve the address instead of guessing (see `GeocodingService`).
 */
export function hasUsableGeoCoordinates(
  coordinates: GeoCoordinates | null | undefined,
): coordinates is GeoCoordinates {
  LoggerService.info(`${FILE_NAME}: hasUsableGeoCoordinates: entry`, {
    hasCoordinates: Boolean(coordinates),
  });

  if (!isValidGeoCoordinates(coordinates)) {
    LoggerService.warn(`${FILE_NAME}: hasUsableGeoCoordinates: rejected — coordinates not valid`);
    return false;
  }

  const isUnsetSentinel =
    Math.abs(coordinates.latitude) < UNSET_COORDINATE_TOLERANCE &&
    Math.abs(coordinates.longitude) < UNSET_COORDINATE_TOLERANCE;

  if (isUnsetSentinel) {
    LoggerService.warn(
      `${FILE_NAME}: hasUsableGeoCoordinates: rejected — 0,0 "not geocoded yet" sentinel`,
    );
    return false;
  }

  LoggerService.info(`${FILE_NAME}: hasUsableGeoCoordinates: usable`, {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  });
  return !isUnsetSentinel;
}
