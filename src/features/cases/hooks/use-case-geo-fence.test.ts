import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DistanceService } from '@/infrastructure/distance';
import { GeocodingService } from '@/infrastructure/geocoding';
import { GeocodingFailedError } from '@/infrastructure/geocoding';
import type { DeviceLocation } from '@/infrastructure/location';
import { useLocationStore } from '@/store/location';
import { useGeoFenceBypassStore } from '@/store/geo-fence';
import { useReferenceDataStore } from '@/store/reference-data';
import type { ReferenceData } from '@/domain/reference-data';

import * as referenceDataRepository from '@/repositories/reference-data-repository';

import { useCaseGeoFence } from './use-case-geo-fence';

jest.mock('@/repositories/reference-data-repository');

jest.mock('@/infrastructure/geocoding', () => {
  class TestGeocodingFailedError extends Error {
    readonly reason: string;

    constructor(reason: string, message: string) {
      super(message);
      this.name = 'GeocodingFailedError';
      this.reason = reason;
    }
  }

  return {
    GeocodingService: {
      resolveAddressCoordinates: jest.fn(),
      clearCache: jest.fn(),
    },
    GeocodingFailedError: TestGeocodingFailedError,
    isGeocodingFailedError: (error: unknown) => error instanceof TestGeocodingFailedError,
  };
});

const CASE_ID = 'case-1';
const CASE_ADDRESS = 'Flat 204, Madhapur, Hyderabad';
/** ~100m north of the case coordinates below. */
const NEARBY_DEVICE_LOCATION: DeviceLocation = {
  latitude: 17.4461,
  longitude: 78.3821,
  accuracyMeters: 6,
  isMockLocation: false,
  capturedAt: new Date('2026-09-04T09:00:00.000Z'),
  source: 'fresh',
};
const CASE_COORDINATES = { latitude: 17.4452, longitude: 78.3821 };

const EMPTY_OPTION_LISTS = {
  verificationTypeStatuses: [],
  utvOptions: [],
  insuffOptions: [],
  photoTypes: [],
  componentStatuses: [],
  actionStatuses: [],
  profileStatuses: [],
} as const;

function seedSettings(values: Record<string, boolean | number | string> | null): void {
  if (values === null) {
    useReferenceDataStore.setState({ referenceData: null });
    return;
  }
  const referenceData: ReferenceData = {
    ...EMPTY_OPTION_LISTS,
    mobileAppSettings: { values, updatedAt: null },
  };
  useReferenceDataStore.setState({ referenceData });
}

function seedReadyLocation(location: DeviceLocation = NEARBY_DEVICE_LOCATION): void {
  useLocationStore.setState({ status: 'ready', location, errorReason: null, isEvaluating: false });
}

function renderGeoFence(overrides: Partial<Parameters<typeof useCaseGeoFence>[0]> = {}) {
  return renderHook(() =>
    useCaseGeoFence({
      caseId: CASE_ID,
      address: CASE_ADDRESS,
      targetCoordinates: CASE_COORDINATES,
      isEnabled: true,
      ...overrides,
    }),
  );
}

describe('useCaseGeoFence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedSettings({ geo_fence_radius_meters: 200, locationRetryCount: 3 });
    useLocationStore.setState({
      status: 'unknown',
      location: null,
      errorReason: null,
      isEvaluating: false,
    });
    // `evaluate` is the real store action; stub it so a Recalculate doesn't
    // reach the platform, and keep the seeded fix in place.
    useLocationStore.setState({ evaluate: jest.fn().mockResolvedValue(undefined) });
    useGeoFenceBypassStore.getState().clearConsents();
  });

  it('passes the geo-fence when the device is inside the configured radius', async () => {
    seedReadyLocation();

    const { result } = await renderGeoFence();

    await waitFor(() => expect(result.current.status).toBe('inside'));
    expect(result.current.isCaseContentUnlocked).toBe(true);
    expect(result.current.distanceMethod).toBe('local');
    expect(result.current.distanceMeters).toBeGreaterThan(95);
    expect(result.current.distanceMeters).toBeLessThan(105);
    expect(result.current.radiusMeters).toBe(200);
  });

  it('fails the geo-fence when the device is outside the configured radius', async () => {
    seedSettings({ geo_fence_radius_meters: 50, locationRetryCount: 3 });
    seedReadyLocation();

    const { result } = await renderGeoFence();

    await waitFor(() => expect(result.current.status).toBe('outside'));
    expect(result.current.isCaseContentUnlocked).toBe(false);
  });

  it('refuses access when the server configuration is unavailable', async () => {
    seedSettings(null);
    seedReadyLocation();

    const { result } = await renderGeoFence();

    await waitFor(() => expect(result.current.status).toBe('configuration_unavailable'));
    expect(result.current.isCaseContentUnlocked).toBe(false);
    expect(result.current.radiusMeters).toBeNull();
    expect(result.current.canForceProceed).toBe(false);
  });

  it('re-fetches the configuration on retry, then completes the check', async () => {
    seedSettings(null);
    seedReadyLocation();
    jest.mocked(referenceDataRepository.fetchReferenceData).mockImplementation(async () => {
      const referenceData: ReferenceData = {
        ...EMPTY_OPTION_LISTS,
        mobileAppSettings: {
          values: { geo_fence_radius_meters: 200, locationRetryCount: 3 },
          updatedAt: null,
        },
      };
      return referenceData;
    });
    const { result } = await renderGeoFence();
    await waitFor(() => expect(result.current.status).toBe('configuration_unavailable'));

    await act(async () => {
      await result.current.recalculate();
    });

    expect(referenceDataRepository.fetchReferenceData).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe('inside'));
  });

  it('does not re-fetch the configuration on a retry when it is already valid', async () => {
    seedSettings({ geo_fence_radius_meters: 50, locationRetryCount: 3 });
    seedReadyLocation();
    const { result } = await renderGeoFence();
    await waitFor(() => expect(result.current.status).toBe('outside'));

    await act(async () => {
      await result.current.recalculate();
    });

    expect(referenceDataRepository.fetchReferenceData).not.toHaveBeenCalled();
  });

  it('refuses access when the configured radius is invalid', async () => {
    seedSettings({ geo_fence_radius_meters: 'nonsense', locationRetryCount: 3 });
    seedReadyLocation();

    const { result } = await renderGeoFence();

    await waitFor(() => expect(result.current.status).toBe('configuration_unavailable'));
  });

  it('waits for the device location instead of measuring against nothing', async () => {
    useLocationStore.setState({ status: 'permission_denied', location: null });

    const { result } = await renderGeoFence();

    await waitFor(() => expect(result.current.status).toBe('awaiting_location'));
    expect(result.current.isCaseContentUnlocked).toBe(false);
  });

  it('measures as soon as the device location becomes ready', async () => {
    useLocationStore.setState({ status: 'obtaining_location', location: null });
    const { result } = await renderGeoFence();
    await waitFor(() => expect(result.current.status).toBe('awaiting_location'));

    await act(async () => {
      seedReadyLocation();
    });

    await waitFor(() => expect(result.current.status).toBe('inside'));
  });

  it('resolves an address-only case location before the GPS fix is available', async () => {
    // Address-only case, with the device fix still being acquired.
    useLocationStore.setState({ status: 'obtaining_location', location: null });
    jest.mocked(GeocodingService.resolveAddressCoordinates).mockResolvedValue({
      coordinates: CASE_COORDINATES,
      source: 'provider',
      formattedAddress: null,
      resolvedAtIso: '2026-09-04T09:00:00.000Z',
      providerName: 'google',
    });

    const { result } = await renderGeoFence({ targetCoordinates: null });

    await waitFor(() => expect(result.current.status).toBe('awaiting_location'));
    // Geocoded (and cached) while waiting, rather than after.
    expect(GeocodingService.resolveAddressCoordinates).toHaveBeenCalledTimes(1);
    expect(result.current.caseCoordinates).toEqual(CASE_COORDINATES);
  });

  it('geocodes an address only once across recalculations', async () => {
    seedReadyLocation();
    jest.mocked(GeocodingService.resolveAddressCoordinates).mockResolvedValue({
      coordinates: CASE_COORDINATES,
      source: 'provider',
      formattedAddress: null,
      resolvedAtIso: '2026-09-04T09:00:00.000Z',
      providerName: 'google',
    });
    const { result } = await renderGeoFence({ targetCoordinates: null });
    await waitFor(() => expect(result.current.status).toBe('inside'));

    await act(async () => {
      await result.current.recalculate();
    });

    // A recalculation re-reads GPS; it must not re-bill the address lookup.
    expect(GeocodingService.resolveAddressCoordinates).toHaveBeenCalledTimes(1);
  });

  it("uses the case's own coordinates and skips the lookup entirely", async () => {
    seedReadyLocation();

    // The default fixture carries coordinates *and* an address, which is the
    // precedence question: digitized coordinates always win.
    const { result } = await renderGeoFence();

    await waitFor(() => expect(result.current.status).toBe('inside'));
    expect(GeocodingService.resolveAddressCoordinates).not.toHaveBeenCalled();
    expect(result.current.caseCoordinates).toEqual(CASE_COORDINATES);
    expect(result.current.isCaseLocationFromCache).toBe(false);
  });

  it('prefers coordinates once a case is digitized, ignoring any earlier geocode', async () => {
    seedReadyLocation();
    jest.mocked(GeocodingService.resolveAddressCoordinates).mockResolvedValue({
      coordinates: { latitude: 17.4, longitude: 78.3 },
      source: 'cache',
      formattedAddress: null,
      resolvedAtIso: '2026-09-01T09:00:00.000Z',
      providerName: 'google',
    });
    // First visit: address-only, so the address gets resolved.
    const { result: beforeDigitization } = await renderGeoFence({ targetCoordinates: null });
    await waitFor(() => expect(beforeDigitization.current.caseCoordinates).not.toBeNull());
    expect(GeocodingService.resolveAddressCoordinates).toHaveBeenCalledTimes(1);

    // Later visit: the back office has geocoded the case server-side.
    const { result: afterDigitization } = await renderGeoFence();

    await waitFor(() => expect(afterDigitization.current.status).toBe('inside'));
    expect(afterDigitization.current.caseCoordinates).toEqual(CASE_COORDINATES);
    expect(afterDigitization.current.isCaseLocationFromCache).toBe(false);
    // No further lookup — the payload is authoritative.
    expect(GeocodingService.resolveAddressCoordinates).toHaveBeenCalledTimes(1);
  });

  it('geocodes an address-only case, then measures against the resolved point', async () => {
    seedReadyLocation();
    jest.mocked(GeocodingService.resolveAddressCoordinates).mockResolvedValue({
      coordinates: CASE_COORDINATES,
      source: 'provider',
      formattedAddress: null,
      resolvedAtIso: '2026-09-04T09:00:00.000Z',
      providerName: 'google',
    });

    const { result } = await renderGeoFence({ targetCoordinates: { latitude: 0, longitude: 0 } });

    await waitFor(() => expect(result.current.status).toBe('inside'));
    expect(GeocodingService.resolveAddressCoordinates).toHaveBeenCalledWith(
      CASE_ADDRESS,
      expect.objectContaining({ providerName: 'google' }),
    );
    expect(result.current.caseCoordinates).toEqual(CASE_COORDINATES);
  });

  it('flags a case location that came from the offline cache', async () => {
    seedReadyLocation();
    jest.mocked(GeocodingService.resolveAddressCoordinates).mockResolvedValue({
      coordinates: CASE_COORDINATES,
      source: 'cache',
      formattedAddress: null,
      resolvedAtIso: '2026-09-01T09:00:00.000Z',
      providerName: 'google',
    });

    const { result } = await renderGeoFence({ targetCoordinates: null });

    await waitFor(() => expect(result.current.status).toBe('inside'));
    expect(result.current.isCaseLocationFromCache).toBe(true);
  });

  it('reports an unresolved case location when offline with no cached coordinates', async () => {
    seedReadyLocation();
    jest
      .mocked(GeocodingService.resolveAddressCoordinates)
      .mockRejectedValue(new GeocodingFailedError('offline', 'offline'));

    const { result } = await renderGeoFence({ targetCoordinates: null });

    await waitFor(() => expect(result.current.status).toBe('case_location_unresolved'));
    expect(result.current.unresolvedReason).toBe('offline');
    expect(result.current.isCaseContentUnlocked).toBe(false);
  });

  it('reports an unresolved case location for a case with neither coordinates nor address', async () => {
    seedReadyLocation();

    const { result } = await renderGeoFence({ targetCoordinates: null, address: '' });

    await waitFor(() => expect(result.current.status).toBe('case_location_unresolved'));
    expect(result.current.unresolvedReason).toBe('invalid_address');
    expect(GeocodingService.resolveAddressCoordinates).not.toHaveBeenCalled();
  });

  it('does nothing until the case detail has loaded', async () => {
    seedReadyLocation();

    const { result } = await renderGeoFence({ isEnabled: false });

    expect(result.current.status).toBe('idle');
    expect(result.current.isCaseContentUnlocked).toBe(false);
  });

  describe('retries and Force Proceed', () => {
    beforeEach(() => {
      seedSettings({ geo_fence_radius_meters: 50, locationRetryCount: 3 });
      seedReadyLocation();
    });

    it('spends one server-configured attempt per recalculation', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));

      expect(result.current.remainingAttempts).toBe(3);

      await act(async () => {
        await result.current.recalculate();
      });

      expect(result.current.attemptCount).toBe(1);
      expect(result.current.remainingAttempts).toBe(2);
      expect(result.current.canForceProceed).toBe(false);
    });

    it('takes a new GPS fix before recalculating', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));

      await act(async () => {
        await result.current.recalculate();
      });

      expect(jest.mocked(useLocationStore.getState().evaluate)).toHaveBeenCalled();
    });

    it('offers Force Proceed only once the retry budget is spent', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await act(async () => {
          await result.current.recalculate();
        });
      }

      expect(result.current.attemptCount).toBe(3);
      expect(result.current.remainingAttempts).toBe(0);
      expect(result.current.canForceProceed).toBe(true);
      // Eligibility is not access — nothing is unlocked without consent.
      expect(result.current.isCaseContentUnlocked).toBe(false);
    });

    it('honours a larger server-configured retry count', async () => {
      seedSettings({ geo_fence_radius_meters: 50, locationRetryCount: 5 });
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await act(async () => {
          await result.current.recalculate();
        });
      }

      expect(result.current.canForceProceed).toBe(false);
      expect(result.current.remainingAttempts).toBe(2);
    });

    it('unlocks the case and records an auditable consent when the user agrees', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await act(async () => {
          await result.current.recalculate();
        });
      }

      await act(async () => {
        result.current.confirmForceProceed();
      });

      expect(result.current.isCaseContentUnlocked).toBe(true);
      expect(result.current.bypassConsent).toMatchObject({
        caseId: CASE_ID,
        radiusMeters: 50,
        attemptCount: 3,
      });
      expect(result.current.bypassConsent?.lastDistanceMeters).toBeGreaterThan(95);
    });

    it('leaves the case blocked when the consent dialog is cancelled', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await act(async () => {
          await result.current.recalculate();
        });
      }

      // Cancelling is simply never calling `confirmForceProceed`.
      expect(result.current.isCaseContentUnlocked).toBe(false);
      expect(result.current.bypassConsent).toBeNull();
    });

    it('refuses a bypass before the retry budget is spent', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));

      await act(async () => {
        result.current.confirmForceProceed();
      });

      expect(result.current.bypassConsent).toBeNull();
      expect(result.current.isCaseContentUnlocked).toBe(false);
    });

    it('keeps a granted consent when the user leaves and returns to the case', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await act(async () => {
          await result.current.recalculate();
        });
      }
      await act(async () => {
        result.current.confirmForceProceed();
      });

      // Re-rendering the hook stands in for navigating away and back: the
      // consent lives in the persisted store, not in the hook's own state.
      const { result: revisited } = await renderGeoFence();

      await waitFor(() => expect(revisited.current.isCaseContentUnlocked).toBe(true));
      expect(revisited.current.attemptCount).toBe(0);
    });

    it('does not leak a consent to a different case', async () => {
      const { result } = await renderGeoFence();
      await waitFor(() => expect(result.current.status).toBe('outside'));
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await act(async () => {
          await result.current.recalculate();
        });
      }
      await act(async () => {
        result.current.confirmForceProceed();
      });

      const { result: otherCase } = await renderGeoFence({ caseId: 'case-2' });

      await waitFor(() => expect(otherCase.current.status).toBe('outside'));
      expect(otherCase.current.isCaseContentUnlocked).toBe(false);
    });
  });

  describe('distance strategy', () => {
    it('reports the route method when the routing provider answers', async () => {
      seedSettings({
        geo_fence_radius_meters: 200,
        locationRetryCount: 3,
        directions_distance_enabled: true,
        maps_api_key: 'test-key',
      });
      seedReadyLocation();
      const measureSpy = jest.spyOn(DistanceService, 'measureDistance').mockResolvedValue({
        distanceMeters: 150,
        distanceMethod: 'directions',
        calculatedAt: new Date(),
        durationSeconds: 90,
      });

      const { result } = await renderGeoFence();

      await waitFor(() => expect(result.current.status).toBe('inside'));
      expect(result.current.distanceMethod).toBe('directions');
      expect(measureSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          directionsConfiguration: expect.objectContaining({ providerName: 'google' }),
        }),
      );
      measureSpy.mockRestore();
    });

    it('does not offer the routing provider a chance when the server has it disabled', async () => {
      seedReadyLocation();
      const measureSpy = jest.spyOn(DistanceService, 'measureDistance');

      const { result } = await renderGeoFence();

      await waitFor(() => expect(result.current.status).toBe('inside'));
      expect(measureSpy).toHaveBeenCalledWith(expect.anything(), {});
      measureSpy.mockRestore();
    });
  });
});
