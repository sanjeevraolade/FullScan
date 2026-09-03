export type { ILocationService } from './location.interface';
export type {
  CurrentLocationOptions,
  DeviceLocation,
  DeviceLocationSource,
  LocationPermissionStatus,
  LocationReadinessStatus,
  LocationUnavailableReason,
  LocationWatchCallback,
  LocationWatchErrorCallback,
} from './location.types';
export { LocationUnavailableError, isLocationUnavailableError } from './location.errors';
export { LocationService } from './location.service';
