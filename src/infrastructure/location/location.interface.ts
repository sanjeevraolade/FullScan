import type {
  CurrentLocationOptions,
  DeviceLocation,
  LocationPermissionStatus,
  LocationWatchCallback,
  LocationWatchErrorCallback,
} from './location.types';

/**
 * The app's only door to platform location. Nothing above
 * `src/infrastructure` may import `@react-native-community/geolocation` or
 * `react-native-permissions` directly, so a platform quirk is fixed in one
 * place and can be mocked wholesale in tests.
 */
export interface ILocationService {
  /**
   * Whether this device has location hardware/services at all. `false` means
   * no amount of permission granting will help.
   */
  isSupported(): Promise<boolean>;
  /** Current permission state without prompting. */
  checkPermission(): Promise<LocationPermissionStatus>;
  /** Prompts if the permission is still askable; returns the resulting state. */
  requestPermission(): Promise<LocationPermissionStatus>;
  /**
   * One-shot fix. Rejects with a `LocationUnavailableError` whose `reason`
   * distinguishes "location services are off" from "no fix yet" from a timeout.
   */
  getCurrentLocation(options?: CurrentLocationOptions): Promise<DeviceLocation>;
  /** Returns a watch id to pass to {@link ILocationService.clearWatch}. */
  watchLocation(onLocation: LocationWatchCallback, onError: LocationWatchErrorCallback): number;
  clearWatch(watchId: number): void;
  /** Opens this app's settings page, for a permanently denied permission. */
  openApplicationSettings(): Promise<void>;
  /**
   * Opens the OS location-services screen where possible (Android), falling
   * back to the app's own settings page (iOS, which exposes no deep link to
   * the system Location Services toggle).
   */
  openLocationServiceSettings(): Promise<void>;
}
