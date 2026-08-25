import { Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { GeolocationResponse } from '@react-native-community/geolocation';
import { PERMISSIONS, RESULTS, check, request } from 'react-native-permissions';

import { LoggerService } from '@/infrastructure/logger';

import type { ILocationService } from './location.interface';
import type { DeviceLocation, LocationWatchCallback, LocationWatchErrorCallback } from './location.types';

const FILE_NAME = 'location.service.ts';

/** The native module puts this on Android responses only; the published types don't declare it. */
interface AndroidMockAwareResponse extends GeolocationResponse {
  readonly mocked?: boolean;
}

function toDeviceLocation(position: GeolocationResponse): DeviceLocation {
  const mockAwarePosition = position as AndroidMockAwareResponse;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    isMockLocation: mockAwarePosition.mocked ?? false,
    capturedAt: new Date(position.timestamp),
  };
}

async function requestPermission(): Promise<boolean> {
  const permission = Platform.select({
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  });

  if (!permission) {
    LoggerService.warn(`${FILE_NAME}: requestPermission: no location permission mapping for this platform`);
    return false;
  }

  const existingStatus = await check(permission);
  if (existingStatus === RESULTS.GRANTED) {
    return true;
  }

  const requestedStatus = await request(permission);
  const isGranted = requestedStatus === RESULTS.GRANTED;
  LoggerService.info(`${FILE_NAME}: requestPermission: location permission requested`, { isGranted });
  return isGranted;
}

function watchLocation(onLocation: LocationWatchCallback, onError: LocationWatchErrorCallback): number {
  LoggerService.info(`${FILE_NAME}: watchLocation: starting location watch`);
  return Geolocation.watchPosition(
    (position) => onLocation(toDeviceLocation(position)),
    (error) => {
      LoggerService.error(`${FILE_NAME}: watchLocation: watch failed`, { code: error.code, message: error.message });
      onError(new Error(error.message));
    },
    { enableHighAccuracy: true, distanceFilter: 0, interval: 2000, fastestInterval: 1000 },
  );
}

function clearWatch(watchId: number): void {
  LoggerService.info(`${FILE_NAME}: clearWatch: stopping location watch`, { watchId });
  Geolocation.clearWatch(watchId);
}

export const LocationService: ILocationService = { requestPermission, watchLocation, clearWatch };
