import { Linking, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { GeolocationError, GeolocationResponse } from '@react-native-community/geolocation';
import { isEmulatorSync } from 'react-native-device-info';
import { PERMISSIONS, RESULTS, check, openSettings, request } from 'react-native-permissions';
import type { Permission } from 'react-native-permissions';

import { LoggerService } from '@/infrastructure/logger';

import { LocationUnavailableError } from './location.errors';
import type { ILocationService } from './location.interface';
import type {
  CurrentLocationOptions,
  DeviceLocation,
  DeviceLocationSource,
  LocationPermissionStatus,
  LocationUnavailableReason,
  LocationWatchCallback,
  LocationWatchErrorCallback,
} from './location.types';

const FILE_NAME = 'location.service.ts';

const DEFAULT_FIX_TIMEOUT_MS = 15000;
/**
 * A fix older than this is reported as `'lastKnown'` rather than `'fresh'`.
 * Geo-fencing rejects anything but a fresh fix, so this is what keeps a
 * platform-cached position from being mistaken for the executive's position
 * right now.
 */
const FRESH_FIX_MAX_AGE_MS = 30000;

/** W3C Geolocation error codes, as re-used by the React Native module. */
const ERROR_CODE_PERMISSION_DENIED = 1;
const ERROR_CODE_POSITION_UNAVAILABLE = 2;
const ERROR_CODE_TIMEOUT = 3;

/**
 * The native module sets `mocked` on both platforms, but the published types
 * don't declare it. Android maps it from `Location.isFromMockProvider()`;
 * iOS 15+ maps it from `CLLocation.sourceInformation.isSimulatedBySoftware`
 * (older iOS versions always report `false`).
 */
interface MockAwareGeolocationResponse extends GeolocationResponse {
  readonly mocked?: boolean;
}

/**
 * Android's location-services-off failure arrives as a generic
 * POSITION_UNAVAILABLE whose message names the missing provider. iOS gives no
 * comparable signal, so a services-off iPhone reports `position_unavailable` —
 * both states block the app and both banners tell the user to check location
 * settings, so the ambiguity is not user-visible.
 */
const SERVICE_DISABLED_MESSAGE_PATTERN = /provider|disabled|turned off|no location/i;

/**
 * Whether the app is running on an iOS Simulator or an Android emulator.
 *
 * Every fix an iOS Simulator produces comes from Xcode/Simulator rather than a
 * GPS receiver, so iOS 15+ correctly reports `isSimulatedBySoftware === true`
 * for all of them — which the native module forwards as `mocked: true`. Taken
 * at face value that permanently blocks the app on every simulator build.
 * Treating a simulated device as un-mocked keeps development usable without
 * weakening the real check: production builds only ever run on real hardware,
 * where a `mocked` fix genuinely means a fake-GPS app or a developer-attached
 * location simulation.
 */
function isSimulatedDevice(): boolean {
  // `isEmulatorSync` memoizes its own native answer, so this stays cheap.
  let resolved: boolean;
  try {
    resolved = isEmulatorSync();
  } catch (error: unknown) {
    // A device that cannot answer is treated as real hardware, so the
    // mock-location check keeps its teeth.
    LoggerService.error(
      `${FILE_NAME}: isSimulatedDevice: device check failed, assuming real hardware`,
      { message: error instanceof Error ? error.message : String(error) },
    );
    resolved = false;
  }

  LoggerService.info(`${FILE_NAME}: isSimulatedDevice: device kind resolved`, {
    isSimulatedDevice: resolved,
  });
  return resolved;
}

/**
 * The platform's mock flag, with the simulator/emulator false positive removed.
 */
function resolveIsMockLocation(position: MockAwareGeolocationResponse): boolean {
  const isPlatformMockReported = position.mocked ?? false;
  if (!isPlatformMockReported) {
    LoggerService.info(`${FILE_NAME}: resolveIsMockLocation: the platform reported a real fix`);
    return false;
  }

  if (isSimulatedDevice()) {
    LoggerService.warn(
      `${FILE_NAME}: resolveIsMockLocation: ignoring the platform mock flag, this is a simulator/emulator build`,
    );
    return false;
  }

  LoggerService.warn(`${FILE_NAME}: resolveIsMockLocation: mock location reported on real hardware`);
  return true;
}

function toDeviceLocationSource(timestamp: number): DeviceLocationSource {
  const ageMs = Date.now() - timestamp;
  const source: DeviceLocationSource = ageMs > FRESH_FIX_MAX_AGE_MS ? 'lastKnown' : 'fresh';
  LoggerService.info(`${FILE_NAME}: toDeviceLocationSource: fix age classified`, { ageMs, source });
  return source;
}

function toDeviceLocation(position: GeolocationResponse): DeviceLocation {
  const isMockLocation = resolveIsMockLocation(position as MockAwareGeolocationResponse);
  // Coordinates are business evidence — log only fix metadata.
  LoggerService.info(`${FILE_NAME}: toDeviceLocation: mapping platform position`, {
    accuracyMeters: position.coords.accuracy,
    isMockLocation,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    isMockLocation,
    capturedAt: new Date(position.timestamp),
    source: toDeviceLocationSource(position.timestamp),
  };
}

function resolveUnavailableReason(error: GeolocationError): LocationUnavailableReason {
  LoggerService.info(`${FILE_NAME}: resolveUnavailableReason: normalizing platform error`, {
    code: error.code,
  });
  if (error.code === ERROR_CODE_PERMISSION_DENIED) {
    LoggerService.warn(`${FILE_NAME}: resolveUnavailableReason: permission denied`);
    return 'permission_denied';
  }
  if (error.code === ERROR_CODE_TIMEOUT) {
    LoggerService.warn(`${FILE_NAME}: resolveUnavailableReason: fix timed out`);
    return 'timeout';
  }
  if (error.code === ERROR_CODE_POSITION_UNAVAILABLE) {
    const isServiceDisabled = SERVICE_DISABLED_MESSAGE_PATTERN.test(error.message ?? '');
    LoggerService.warn(`${FILE_NAME}: resolveUnavailableReason: position unavailable`, {
      isServiceDisabled,
    });
    return isServiceDisabled ? 'service_disabled' : 'position_unavailable';
  }
  LoggerService.warn(`${FILE_NAME}: resolveUnavailableReason: unrecognized error code`, {
    code: error.code,
  });
  return 'unknown';
}

function resolvePlatformPermission(): Permission | null {
  const permission =
    Platform.select({
      ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    }) ?? null;
  LoggerService.info(`${FILE_NAME}: resolvePlatformPermission: platform permission resolved`, {
    hasPermissionMapping: permission !== null,
  });
  return permission;
}

function toPermissionStatus(result: string): LocationPermissionStatus {
  LoggerService.info(`${FILE_NAME}: toPermissionStatus: mapping platform permission result`, {
    result,
  });
  switch (result) {
    case RESULTS.GRANTED:
    // iOS "Allow Once"/reduced accuracy still gives us a usable fix.
    case RESULTS.LIMITED:
      LoggerService.info(`${FILE_NAME}: toPermissionStatus: mapped to granted`);
      return 'granted';
    case RESULTS.BLOCKED:
      LoggerService.warn(`${FILE_NAME}: toPermissionStatus: mapped to blocked`);
      return 'blocked';
    case RESULTS.UNAVAILABLE:
      LoggerService.warn(`${FILE_NAME}: toPermissionStatus: mapped to unavailable`);
      return 'unavailable';
    default:
      LoggerService.warn(`${FILE_NAME}: toPermissionStatus: mapped to denied`);
      return 'denied';
  }
}

async function isSupported(): Promise<boolean> {
  LoggerService.info(`${FILE_NAME}: isSupported: checking device location support`);
  const permission = resolvePlatformPermission();
  if (!permission) {
    LoggerService.warn(`${FILE_NAME}: isSupported: no location permission mapping for this platform`);
    return false;
  }

  const status = toPermissionStatus(await check(permission));
  const isDeviceSupported = status !== 'unavailable';
  LoggerService.info(`${FILE_NAME}: isSupported: device location support resolved`, {
    isDeviceSupported,
  });
  return isDeviceSupported;
}

async function checkPermission(): Promise<LocationPermissionStatus> {
  LoggerService.info(`${FILE_NAME}: checkPermission: checking location permission`);
  const permission = resolvePlatformPermission();
  if (!permission) {
    LoggerService.warn(`${FILE_NAME}: checkPermission: no location permission mapping for this platform`);
    return 'unavailable';
  }

  const status = toPermissionStatus(await check(permission));
  LoggerService.info(`${FILE_NAME}: checkPermission: permission checked`, { status });
  return status;
}

async function requestPermission(): Promise<LocationPermissionStatus> {
  LoggerService.info(`${FILE_NAME}: requestPermission: requesting location permission`);
  const permission = resolvePlatformPermission();
  if (!permission) {
    LoggerService.warn(`${FILE_NAME}: requestPermission: no location permission mapping for this platform`);
    return 'unavailable';
  }

  const existingStatus = toPermissionStatus(await check(permission));
  if (existingStatus === 'granted' || existingStatus === 'blocked' || existingStatus === 'unavailable') {
    // Re-requesting a blocked permission is a silent no-op on both platforms;
    // the caller has to send the user to Settings instead.
    LoggerService.info(`${FILE_NAME}: requestPermission: not prompting`, { status: existingStatus });
    return existingStatus;
  }

  const requestedStatus = toPermissionStatus(await request(permission));
  LoggerService.info(`${FILE_NAME}: requestPermission: location permission requested`, {
    status: requestedStatus,
  });
  return requestedStatus;
}

async function getCurrentLocation(options: CurrentLocationOptions = {}): Promise<DeviceLocation> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_FIX_TIMEOUT_MS;
  const maximumAgeMs = options.maximumAgeMs ?? 0;
  const enableHighAccuracy = options.isHighAccuracyEnabled ?? true;

  LoggerService.info(`${FILE_NAME}: getCurrentLocation: requesting a fix`, {
    timeoutMs,
    maximumAgeMs,
    enableHighAccuracy,
  });

  return new Promise<DeviceLocation>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        const location = toDeviceLocation(position);
        // Coordinates themselves are business evidence — log only metadata.
        LoggerService.info(`${FILE_NAME}: getCurrentLocation: fix obtained`, {
          accuracyMeters: location.accuracyMeters,
          isMockLocation: location.isMockLocation,
          source: location.source,
        });
        resolve(location);
      },
      (error) => {
        const reason = resolveUnavailableReason(error);
        LoggerService.error(`${FILE_NAME}: getCurrentLocation: fix failed`, {
          code: error.code,
          reason,
        });
        reject(new LocationUnavailableError(reason, error.message ?? 'location unavailable'));
      },
      { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
    );
  });
}

function watchLocation(onLocation: LocationWatchCallback, onError: LocationWatchErrorCallback): number {
  LoggerService.info(`${FILE_NAME}: watchLocation: starting location watch`);
  return Geolocation.watchPosition(
    (position) => {
      LoggerService.info(`${FILE_NAME}: watchLocation: position update received`);
      onLocation(toDeviceLocation(position));
    },
    (error) => {
      const reason = resolveUnavailableReason(error);
      LoggerService.error(`${FILE_NAME}: watchLocation: watch failed`, { code: error.code, reason });
      onError(new LocationUnavailableError(reason, error.message ?? 'location unavailable'));
    },
    { enableHighAccuracy: true, distanceFilter: 0, interval: 2000, fastestInterval: 1000 },
  );
}

function clearWatch(watchId: number): void {
  LoggerService.info(`${FILE_NAME}: clearWatch: stopping location watch`, { watchId });
  Geolocation.clearWatch(watchId);
}

async function openApplicationSettings(): Promise<void> {
  LoggerService.info(`${FILE_NAME}: openApplicationSettings: opening app settings`);
  await openSettings();
  LoggerService.info(`${FILE_NAME}: openApplicationSettings: app settings opened`);
}

/** Android's system Location Services screen; iOS has no such deep link. */
const ANDROID_LOCATION_SETTINGS_INTENT = 'android.settings.LOCATION_SOURCE_SETTINGS';

async function openLocationServiceSettings(): Promise<void> {
  LoggerService.info(`${FILE_NAME}: openLocationServiceSettings: resolving settings deep link`, {
    platform: Platform.OS,
  });
  if (Platform.OS !== 'android') {
    LoggerService.info(
      `${FILE_NAME}: openLocationServiceSettings: no system location deep link on this platform, opening app settings`,
    );
    await openApplicationSettings();
    return;
  }

  LoggerService.info(`${FILE_NAME}: openLocationServiceSettings: opening system location settings`);
  try {
    await Linking.sendIntent(ANDROID_LOCATION_SETTINGS_INTENT);
    LoggerService.info(
      `${FILE_NAME}: openLocationServiceSettings: system location settings opened`,
    );
  } catch (error: unknown) {
    LoggerService.error(
      `${FILE_NAME}: openLocationServiceSettings: system location settings unavailable, opening app settings`,
      { message: error instanceof Error ? error.message : String(error) },
    );
    await openApplicationSettings();
  }
}

export const LocationService: ILocationService = {
  isSupported,
  checkPermission,
  requestPermission,
  getCurrentLocation,
  watchLocation,
  clearWatch,
  openApplicationSettings,
  openLocationServiceSettings,
};
