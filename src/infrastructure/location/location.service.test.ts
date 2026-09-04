import Geolocation from '@react-native-community/geolocation';
import type { GeolocationError, GeolocationResponse } from '@react-native-community/geolocation';
import { isEmulatorSync } from 'react-native-device-info';
import { RESULTS, check, openSettings, request } from 'react-native-permissions';

import { isLocationUnavailableError } from './location.errors';
import { LocationService } from './location.service';

function buildPosition(
  overrides: Partial<GeolocationResponse['coords']> = {},
  timestamp = Date.now(),
): GeolocationResponse {
  return {
    coords: {
      latitude: 17.4452,
      longitude: 78.3821,
      accuracy: 6,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...overrides,
    },
    timestamp,
  } as GeolocationResponse;
}

/** A fix the platform has flagged as faked — Android's mock provider, or iOS 15+'s simulated source. */
function buildMockedPosition(): GeolocationResponse {
  return { ...buildPosition(), mocked: true } as GeolocationResponse;
}

function buildError(code: number, message: string): GeolocationError {
  return { code, message } as GeolocationError;
}

/** Drives the `getCurrentPosition(success, failure, options)` callback API. */
function mockPositionSuccess(position: GeolocationResponse): void {
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation((onSuccess) => {
    (onSuccess as (value: GeolocationResponse) => void)(position);
  });
}

function mockPositionFailure(error: GeolocationError): void {
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation((_onSuccess, onError) => {
    (onError as (value: GeolocationError) => void)(error);
  });
}

describe('LocationService.isSupported', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports support when the platform can be asked for the permission', async () => {
    jest.mocked(check).mockResolvedValue(RESULTS.DENIED);

    await expect(LocationService.isSupported()).resolves.toBe(true);
  });

  it('reports no support when the platform says the feature is unavailable', async () => {
    jest.mocked(check).mockResolvedValue(RESULTS.UNAVAILABLE);

    await expect(LocationService.isSupported()).resolves.toBe(false);
  });
});

describe('LocationService.checkPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [RESULTS.GRANTED, 'granted'],
    [RESULTS.LIMITED, 'granted'],
    [RESULTS.DENIED, 'denied'],
    [RESULTS.BLOCKED, 'blocked'],
    [RESULTS.UNAVAILABLE, 'unavailable'],
  ])('maps the platform result %s to %s', async (platformResult, expected) => {
    jest.mocked(check).mockResolvedValue(platformResult);

    await expect(LocationService.checkPermission()).resolves.toBe(expected);
  });
});

describe('LocationService.requestPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not prompt when the permission is already granted', async () => {
    jest.mocked(check).mockResolvedValue(RESULTS.GRANTED);

    await expect(LocationService.requestPermission()).resolves.toBe('granted');
    expect(request).not.toHaveBeenCalled();
  });

  it('does not prompt when the permission is permanently blocked', async () => {
    jest.mocked(check).mockResolvedValue(RESULTS.BLOCKED);

    await expect(LocationService.requestPermission()).resolves.toBe('blocked');
    expect(request).not.toHaveBeenCalled();
  });

  it('prompts when the permission is still askable', async () => {
    jest.mocked(check).mockResolvedValue(RESULTS.DENIED);
    jest.mocked(request).mockResolvedValue(RESULTS.GRANTED);

    await expect(LocationService.requestPermission()).resolves.toBe('granted');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports the denial when the user declines the prompt', async () => {
    jest.mocked(check).mockResolvedValue(RESULTS.DENIED);
    jest.mocked(request).mockResolvedValue(RESULTS.BLOCKED);

    await expect(LocationService.requestPermission()).resolves.toBe('blocked');
  });
});

describe('LocationService.getCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Real hardware is the default; the simulator cases override it.
    jest.mocked(isEmulatorSync).mockReturnValue(false);
  });

  it('normalizes a successful fix and marks it fresh', async () => {
    mockPositionSuccess(buildPosition());

    const location = await LocationService.getCurrentLocation();

    expect(location).toMatchObject({
      latitude: 17.4452,
      longitude: 78.3821,
      accuracyMeters: 6,
      isMockLocation: false,
      source: 'fresh',
    });
  });

  it('marks a platform-cached fix as lastKnown rather than current', async () => {
    mockPositionSuccess(buildPosition({}, Date.now() - 10 * 60 * 1000));

    const location = await LocationService.getCurrentLocation({ maximumAgeMs: 600_000 });

    expect(location.source).toBe('lastKnown');
  });

  it("surfaces the platform's mock-location flag on real hardware", async () => {
    jest.mocked(isEmulatorSync).mockReturnValue(false);
    mockPositionSuccess(buildMockedPosition());

    await expect(LocationService.getCurrentLocation()).resolves.toMatchObject({
      isMockLocation: true,
    });
  });

  /**
   * Every iOS Simulator fix is software-generated, so iOS 15+ reports
   * `isSimulatedBySoftware` for all of them — trusting that would block the app
   * on every simulator build.
   */
  it('ignores the mock-location flag on a simulator/emulator', async () => {
    jest.mocked(isEmulatorSync).mockReturnValue(true);
    mockPositionSuccess(buildMockedPosition());

    await expect(LocationService.getCurrentLocation()).resolves.toMatchObject({
      isMockLocation: false,
    });
  });

  it('treats a device that cannot report its kind as real hardware', async () => {
    jest.mocked(isEmulatorSync).mockImplementation(() => {
      throw new Error('native module unavailable');
    });
    mockPositionSuccess(buildMockedPosition());

    await expect(LocationService.getCurrentLocation()).resolves.toMatchObject({
      isMockLocation: true,
    });
  });

  it('requests a fresh fix by default', async () => {
    mockPositionSuccess(buildPosition());

    await LocationService.getCurrentLocation();

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ maximumAge: 0, enableHighAccuracy: true }),
    );
  });

  it('classifies a disabled-provider failure as service_disabled', async () => {
    mockPositionFailure(buildError(2, 'No location provider available.'));

    await expect(LocationService.getCurrentLocation()).rejects.toMatchObject({
      reason: 'service_disabled',
    });
  });

  it('classifies a generic unavailable failure as position_unavailable', async () => {
    mockPositionFailure(buildError(2, 'Unable to retrieve position'));

    await expect(LocationService.getCurrentLocation()).rejects.toMatchObject({
      reason: 'position_unavailable',
    });
  });

  it('classifies a timeout', async () => {
    mockPositionFailure(buildError(3, 'Location request timed out'));

    await expect(LocationService.getCurrentLocation()).rejects.toMatchObject({
      reason: 'timeout',
    });
  });

  it('classifies a permission failure', async () => {
    mockPositionFailure(buildError(1, 'User denied access to location services.'));

    await expect(LocationService.getCurrentLocation()).rejects.toMatchObject({
      reason: 'permission_denied',
    });
  });

  it('rejects with a recognizable typed error', async () => {
    mockPositionFailure(buildError(3, 'timed out'));
    expect.assertions(1);

    try {
      await LocationService.getCurrentLocation();
    } catch (error: unknown) {
      expect(isLocationUnavailableError(error)).toBe(true);
    }
  });
});

describe('LocationService.openApplicationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the app settings page', async () => {
    await LocationService.openApplicationSettings();

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('falls back to app settings on platforms with no location-services deep link', async () => {
    // The Jest preset reports Platform.OS as 'ios', which has no such link.
    await LocationService.openLocationServiceSettings();

    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});
