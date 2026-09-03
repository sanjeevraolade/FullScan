import { LocationService, LocationUnavailableError } from '@/infrastructure/location';
import type { DeviceLocation } from '@/infrastructure/location';
import { useReferenceDataStore } from '@/store/reference-data';
import type { ReferenceData } from '@/domain/reference-data';

import { isLocationReady, useLocationStore } from './location.store';

jest.mock('@/infrastructure/location', () => {
  class TestLocationUnavailableError extends Error {
    readonly reason: string;

    constructor(reason: string, message: string) {
      super(message);
      this.name = 'LocationUnavailableError';
      this.reason = reason;
    }
  }

  return {
    LocationService: {
      isSupported: jest.fn(),
      checkPermission: jest.fn(),
      requestPermission: jest.fn(),
      getCurrentLocation: jest.fn(),
      watchLocation: jest.fn(),
      clearWatch: jest.fn(),
      openApplicationSettings: jest.fn(),
      openLocationServiceSettings: jest.fn(),
    },
    LocationUnavailableError: TestLocationUnavailableError,
    isLocationUnavailableError: (error: unknown) => error instanceof TestLocationUnavailableError,
  };
});

const EMPTY_OPTION_LISTS = {
  verificationTypeStatuses: [],
  utvOptions: [],
  insuffOptions: [],
  photoTypes: [],
  componentStatuses: [],
  actionStatuses: [],
  profileStatuses: [],
} as const;

function seedSettings(values: Record<string, boolean | number | string>): void {
  const referenceData: ReferenceData = {
    ...EMPTY_OPTION_LISTS,
    mobileAppSettings: { values, updatedAt: null },
  };
  useReferenceDataStore.setState({ referenceData });
}

function buildLocation(overrides: Partial<DeviceLocation> = {}): DeviceLocation {
  return {
    latitude: 17.4452,
    longitude: 78.3821,
    accuracyMeters: 6,
    isMockLocation: false,
    capturedAt: new Date('2026-09-04T09:00:00.000Z'),
    source: 'fresh',
    ...overrides,
  };
}

function mockHappyPath(): void {
  jest.mocked(LocationService.isSupported).mockResolvedValue(true);
  jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
  jest.mocked(LocationService.getCurrentLocation).mockResolvedValue(buildLocation());
}

describe('useLocationStore.evaluate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.getState().reset();
    useReferenceDataStore.setState({ referenceData: null });
  });

  it('reaches `ready` with a fresh fix when everything is in place', async () => {
    mockHappyPath();

    await useLocationStore.getState().evaluate();

    const { status, location } = useLocationStore.getState();
    expect(status).toBe('ready');
    expect(location).toMatchObject({ latitude: 17.4452, source: 'fresh' });
    expect(isLocationReady(status)).toBe(true);
  });

  it('reports `unsupported` on a device without location hardware', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(false);

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState().status).toBe('unsupported');
    expect(LocationService.getCurrentLocation).not.toHaveBeenCalled();
  });

  it('reports `unsupported` when the platform says the permission is unavailable', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('unavailable');

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState().status).toBe('unsupported');
  });

  it('reports `permission_required` when the permission is still askable', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('denied');

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState().status).toBe('permission_required');
  });

  it('reports `permission_denied` when the permission is permanently blocked', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('blocked');

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState().status).toBe('permission_denied');
  });

  it('reports `service_disabled` when location services are switched off', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
    jest
      .mocked(LocationService.getCurrentLocation)
      .mockRejectedValue(new LocationUnavailableError('service_disabled', 'no provider'));

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState().status).toBe('service_disabled');
  });

  it('reports `error` with the reason when a granted permission still yields no fix', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
    jest
      .mocked(LocationService.getCurrentLocation)
      .mockRejectedValue(new LocationUnavailableError('timeout', 'timed out'));

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState()).toMatchObject({ status: 'error', errorReason: 'timeout' });
  });

  it('blocks with `mock_detected` when a faked position is reported', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
    jest
      .mocked(LocationService.getCurrentLocation)
      .mockResolvedValue(buildLocation({ isMockLocation: true }));
    seedSettings({ mock_location_block_enabled: true });

    await useLocationStore.getState().evaluate();

    const { status, location } = useLocationStore.getState();
    expect(status).toBe('mock_detected');
    expect(location).toBeNull();
  });

  it('honours the server switch that turns mock-location blocking off', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
    jest
      .mocked(LocationService.getCurrentLocation)
      .mockResolvedValue(buildLocation({ isMockLocation: true }));
    seedSettings({ mock_location_block_enabled: false });

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState().status).toBe('ready');
  });

  it('blocks mock locations by default when configuration has not loaded', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
    jest
      .mocked(LocationService.getCurrentLocation)
      .mockResolvedValue(buildLocation({ isMockLocation: true }));

    await useLocationStore.getState().evaluate();

    expect(useLocationStore.getState().status).toBe('mock_detected');
  });

  it('refuses to treat a stale platform fix as the current position', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
    jest
      .mocked(LocationService.getCurrentLocation)
      .mockResolvedValue(buildLocation({ source: 'lastKnown' }));

    await useLocationStore.getState().evaluate();

    const { status, location } = useLocationStore.getState();
    expect(status).toBe('error');
    expect(location).toBeNull();
  });

  it('lets the newest evaluation win when two overlap', async () => {
    jest.mocked(LocationService.isSupported).mockResolvedValue(true);
    jest.mocked(LocationService.checkPermission).mockResolvedValue('granted');
    jest
      .mocked(LocationService.getCurrentLocation)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(buildLocation({ accuracyMeters: 999 })), 20);
          }),
      )
      .mockResolvedValue(buildLocation({ accuracyMeters: 5 }));

    const slowEvaluation = useLocationStore.getState().evaluate();
    await useLocationStore.getState().evaluate();
    await slowEvaluation;

    expect(useLocationStore.getState().location).toMatchObject({ accuracyMeters: 5 });
  });
});

describe('useLocationStore.requestPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.getState().reset();
  });

  it('re-evaluates readiness once the user grants the permission', async () => {
    jest.mocked(LocationService.requestPermission).mockResolvedValue('granted');
    mockHappyPath();

    await useLocationStore.getState().requestPermission();

    expect(useLocationStore.getState().status).toBe('ready');
  });

  it('moves to `permission_denied` when the user blocks it in the prompt', async () => {
    jest.mocked(LocationService.requestPermission).mockResolvedValue('blocked');

    await useLocationStore.getState().requestPermission();

    expect(useLocationStore.getState().status).toBe('permission_denied');
    expect(LocationService.getCurrentLocation).not.toHaveBeenCalled();
  });
});

describe('useLocationStore.openSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.getState().reset();
  });

  it('opens the app settings page for a blocked permission', async () => {
    useLocationStore.setState({ status: 'permission_denied' });

    await useLocationStore.getState().openSettings();

    expect(LocationService.openApplicationSettings).toHaveBeenCalledTimes(1);
  });

  it('opens the system location settings for disabled services and mock locations', async () => {
    useLocationStore.setState({ status: 'service_disabled' });
    await useLocationStore.getState().openSettings();

    useLocationStore.setState({ status: 'mock_detected' });
    await useLocationStore.getState().openSettings();

    expect(LocationService.openLocationServiceSettings).toHaveBeenCalledTimes(2);
  });
});
