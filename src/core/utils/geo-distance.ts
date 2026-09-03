import type { GeoCoordinates } from '@/core/types';
import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'geo-distance.ts';

/** Mean Earth radius (IUGG), in metres — the value the Haversine formula assumes. */
const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * Deliberately uninstrumented: it is called four times per distance calculation
 * and a per-call log would bury the surrounding trace. The values it converts
 * are already visible in `calculateHaversineDistanceMeters`'s own logs.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle ("straight line") distance between two points, in metres, via
 * the Haversine formula.
 *
 * This is the app's offline, zero-cost, deterministic distance source and the
 * only one geo-fence decisions are allowed to depend on — no network, no API
 * key, no billing. Route/travel distance (which is always longer) comes from
 * `DirectionsDistanceService` and is informational only.
 */
export function calculateHaversineDistanceMeters(from: GeoCoordinates, to: GeoCoordinates): number {
  LoggerService.info(`${FILE_NAME}: calculateHaversineDistanceMeters: entry`, {
    fromLatitude: from.latitude,
    fromLongitude: from.longitude,
    toLatitude: to.latitude,
    toLongitude: to.longitude,
  });

  const fromLatitudeRadians = toRadians(from.latitude);
  const toLatitudeRadians = toRadians(to.latitude);
  const latitudeDeltaRadians = toRadians(to.latitude - from.latitude);
  const longitudeDeltaRadians = toRadians(to.longitude - from.longitude);

  const haversine =
    Math.sin(latitudeDeltaRadians / 2) ** 2 +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(longitudeDeltaRadians / 2) ** 2;

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const distanceMeters = EARTH_RADIUS_METERS * centralAngle;

  if (!Number.isFinite(distanceMeters)) {
    LoggerService.warn(
      `${FILE_NAME}: calculateHaversineDistanceMeters: non-finite distance — check inputs`,
    );
    return distanceMeters;
  }

  LoggerService.info(`${FILE_NAME}: calculateHaversineDistanceMeters: distance computed`, {
    distanceMeters,
  });
  return distanceMeters;
}
