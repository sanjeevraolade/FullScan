import type { GeoCoordinates } from '@/core/types';
import { ConnectivityService } from '@/infrastructure/networking';
import { KeyValueStorageService } from '@/infrastructure/storage';

import { GeocodingService, registerGeocodingProvider } from './geocoding.service';
import { GeocodingFailedError } from './geocoding.errors';
import type {
  GeocodedAddress,
  IGeocodingProvider,
  ReverseGeocodedAddress,
} from './geocoding-provider.interface';
import type { GeocodingProviderConfiguration } from './geocoding.types';

jest.mock('@/infrastructure/networking', () => ({
  ConnectivityService: { isConnected: jest.fn() },
}));

const CASE_ADDRESS = 'Flat 204, Madhapur, Hyderabad';
const TEST_PROVIDER_NAME = 'test-provider';
const CAPTURE_POINT: GeoCoordinates = { latitude: 17.4452, longitude: 78.3821 };

const geocodeAddress = jest.fn<
  Promise<GeocodedAddress | null>,
  [string, GeocodingProviderConfiguration]
>();
const reverseGeocodeCoordinates = jest.fn<
  Promise<ReverseGeocodedAddress | null>,
  [GeoCoordinates, GeocodingProviderConfiguration]
>();
const isConfigured = jest.fn<boolean, [GeocodingProviderConfiguration]>();

const testProvider: IGeocodingProvider = {
  name: TEST_PROVIDER_NAME,
  isConfigured: (configuration) => isConfigured(configuration),
  geocodeAddress: (address, configuration) => geocodeAddress(address, configuration),
  reverseGeocodeCoordinates: (coordinates, configuration) =>
    reverseGeocodeCoordinates(coordinates, configuration),
};

function buildConfiguration(
  overrides: Partial<GeocodingProviderConfiguration> = {},
): GeocodingProviderConfiguration {
  return { providerName: TEST_PROVIDER_NAME, apiKey: 'test-key', baseUrl: '', ...overrides };
}

describe('GeocodingService', () => {
  beforeAll(() => {
    registerGeocodingProvider(testProvider);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    GeocodingService.clearCache();
    isConfigured.mockReturnValue(true);
    jest.mocked(ConnectivityService.isConnected).mockResolvedValue(true);
  });

  it('resolves an address through the configured provider', async () => {
    geocodeAddress.mockResolvedValue({
      coordinates: { latitude: 17.4452, longitude: 78.3821 },
      formattedAddress: 'Madhapur, Hyderabad, Telangana 500081, India',
    });

    const resolved = await GeocodingService.resolveAddressCoordinates(
      CASE_ADDRESS,
      buildConfiguration(),
    );

    expect(resolved.coordinates).toEqual({ latitude: 17.4452, longitude: 78.3821 });
    expect(resolved.source).toBe('provider');
    expect(resolved.providerName).toBe(TEST_PROVIDER_NAME);
  });

  it('caches a successful resolution so the same address is never billed twice', async () => {
    geocodeAddress.mockResolvedValue({
      coordinates: { latitude: 17.4452, longitude: 78.3821 },
      formattedAddress: null,
    });

    await GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration());
    const second = await GeocodingService.resolveAddressCoordinates(
      CASE_ADDRESS,
      buildConfiguration(),
    );

    expect(geocodeAddress).toHaveBeenCalledTimes(1);
    expect(second.source).toBe('cache');
    expect(second.coordinates).toEqual({ latitude: 17.4452, longitude: 78.3821 });
  });

  it('treats whitespace and case differences as the same address', async () => {
    geocodeAddress.mockResolvedValue({
      coordinates: { latitude: 17.4452, longitude: 78.3821 },
      formattedAddress: null,
    });

    await GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration());
    await GeocodingService.resolveAddressCoordinates(
      '  flat 204,   MADHAPUR, hyderabad  ',
      buildConfiguration(),
    );

    expect(geocodeAddress).toHaveBeenCalledTimes(1);
  });

  it('serves a cached coordinate while offline — this is what makes an address-only case usable in the field', async () => {
    geocodeAddress.mockResolvedValue({
      coordinates: { latitude: 17.4452, longitude: 78.3821 },
      formattedAddress: null,
    });
    await GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration());

    jest.mocked(ConnectivityService.isConnected).mockResolvedValue(false);
    const offlineResult = await GeocodingService.resolveAddressCoordinates(
      CASE_ADDRESS,
      buildConfiguration(),
    );

    expect(offlineResult.source).toBe('cache');
  });

  it('fails with `offline` rather than guessing when there is no cache and no network', async () => {
    jest.mocked(ConnectivityService.isConnected).mockResolvedValue(false);

    await expect(
      GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration()),
    ).rejects.toMatchObject({ reason: 'offline' });
    expect(geocodeAddress).not.toHaveBeenCalled();
  });

  it('fails with `not_found` when the provider is certain the address has no match', async () => {
    geocodeAddress.mockResolvedValue(null);

    await expect(
      GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration()),
    ).rejects.toMatchObject({ reason: 'not_found' });
  });

  it('fails with `not_configured` when the provider has no credentials', async () => {
    isConfigured.mockReturnValue(false);

    await expect(
      GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration({ apiKey: '' })),
    ).rejects.toMatchObject({ reason: 'not_configured' });
  });

  it('fails with `not_configured` when the configured provider id is unknown to this build', async () => {
    await expect(
      GeocodingService.resolveAddressCoordinates(
        CASE_ADDRESS,
        buildConfiguration({ providerName: 'some-future-vendor' }),
      ),
    ).rejects.toMatchObject({ reason: 'not_configured' });
  });

  it('rejects a blank address without calling the provider', async () => {
    await expect(
      GeocodingService.resolveAddressCoordinates('   ', buildConfiguration()),
    ).rejects.toMatchObject({ reason: 'invalid_address' });
    expect(geocodeAddress).not.toHaveBeenCalled();
  });

  it('propagates a transient provider failure so the caller can retry', async () => {
    geocodeAddress.mockRejectedValue(new GeocodingFailedError('provider_error', 'boom'));

    await expect(
      GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration()),
    ).rejects.toMatchObject({ reason: 'provider_error' });
  });

  it('does not cache a failure', async () => {
    geocodeAddress.mockRejectedValueOnce(new GeocodingFailedError('provider_error', 'boom'));
    geocodeAddress.mockResolvedValueOnce({
      coordinates: { latitude: 1, longitude: 2 },
      formattedAddress: null,
    });

    await expect(
      GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration()),
    ).rejects.toBeDefined();
    const retried = await GeocodingService.resolveAddressCoordinates(
      CASE_ADDRESS,
      buildConfiguration(),
    );

    expect(retried.coordinates).toEqual({ latitude: 1, longitude: 2 });
  });

  it('discards a corrupt cache entry instead of failing the lookup', async () => {
    geocodeAddress.mockResolvedValue({
      coordinates: { latitude: 17.4452, longitude: 78.3821 },
      formattedAddress: null,
    });
    await GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration());

    const [cacheKey] = KeyValueStorageService.getAllKeys().filter((key) =>
      key.startsWith('geocoding:v1:'),
    );
    KeyValueStorageService.setString(cacheKey ?? '', '{not json');

    const resolved = await GeocodingService.resolveAddressCoordinates(
      CASE_ADDRESS,
      buildConfiguration(),
    );

    expect(resolved.source).toBe('provider');
  });

  describe('resolveCoordinatesAddress', () => {
    it('resolves a point to an address through the configured provider', async () => {
      reverseGeocodeCoordinates.mockResolvedValue({
        formattedAddress: 'Madhapur, Hyderabad, Telangana 500081, India',
      });

      const resolved = await GeocodingService.resolveCoordinatesAddress(
        CAPTURE_POINT,
        buildConfiguration(),
      );

      expect(resolved.formattedAddress).toBe('Madhapur, Hyderabad, Telangana 500081, India');
      expect(resolved.source).toBe('provider');
      expect(resolved.providerName).toBe(TEST_PROVIDER_NAME);
    });

    it('re-uses the cached address for a nearby fix so a photo burst is billed once', async () => {
      reverseGeocodeCoordinates.mockResolvedValue({ formattedAddress: 'Madhapur, Hyderabad' });

      await GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration());
      // ~1 m of GPS jitter — the same doorstep, inside the cache grid.
      const second = await GeocodingService.resolveCoordinatesAddress(
        { latitude: 17.44521, longitude: 78.38212 },
        buildConfiguration(),
      );

      expect(reverseGeocodeCoordinates).toHaveBeenCalledTimes(1);
      expect(second.source).toBe('cache');
      expect(second.formattedAddress).toBe('Madhapur, Hyderabad');
    });

    it('resolves a genuinely different location instead of re-using the cached address', async () => {
      reverseGeocodeCoordinates.mockResolvedValue({ formattedAddress: 'Madhapur, Hyderabad' });
      await GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration());

      // ~2 km away — a different address, well outside the cache grid.
      await GeocodingService.resolveCoordinatesAddress(
        { latitude: 17.4652, longitude: 78.3821 },
        buildConfiguration(),
      );

      expect(reverseGeocodeCoordinates).toHaveBeenCalledTimes(2);
    });

    it('serves a cached address while offline', async () => {
      reverseGeocodeCoordinates.mockResolvedValue({ formattedAddress: 'Madhapur, Hyderabad' });
      await GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration());

      jest.mocked(ConnectivityService.isConnected).mockResolvedValue(false);
      const offlineResult = await GeocodingService.resolveCoordinatesAddress(
        CAPTURE_POINT,
        buildConfiguration(),
      );

      expect(offlineResult.source).toBe('cache');
    });

    it('fails with `offline` rather than guessing when there is no cache and no network', async () => {
      jest.mocked(ConnectivityService.isConnected).mockResolvedValue(false);

      await expect(
        GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration()),
      ).rejects.toMatchObject({ reason: 'offline' });
      expect(reverseGeocodeCoordinates).not.toHaveBeenCalled();
    });

    it('fails with `not_found` when nothing is mapped at the point', async () => {
      reverseGeocodeCoordinates.mockResolvedValue(null);

      await expect(
        GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration()),
      ).rejects.toMatchObject({ reason: 'not_found' });
    });

    it('rejects out-of-range coordinates without calling the provider', async () => {
      await expect(
        GeocodingService.resolveCoordinatesAddress(
          { latitude: 91, longitude: 78.3821 },
          buildConfiguration(),
        ),
      ).rejects.toMatchObject({ reason: 'invalid_coordinates' });
      expect(reverseGeocodeCoordinates).not.toHaveBeenCalled();
    });

    it('fails with `not_configured` when the provider has no credentials', async () => {
      isConfigured.mockReturnValue(false);

      await expect(
        GeocodingService.resolveCoordinatesAddress(
          CAPTURE_POINT,
          buildConfiguration({ apiKey: '' }),
        ),
      ).rejects.toMatchObject({ reason: 'not_configured' });
    });

    it('does not cache a failure', async () => {
      reverseGeocodeCoordinates.mockRejectedValueOnce(
        new GeocodingFailedError('provider_error', 'boom'),
      );
      reverseGeocodeCoordinates.mockResolvedValueOnce({ formattedAddress: 'Madhapur, Hyderabad' });

      await expect(
        GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration()),
      ).rejects.toBeDefined();
      const retried = await GeocodingService.resolveCoordinatesAddress(
        CAPTURE_POINT,
        buildConfiguration(),
      );

      expect(retried.formattedAddress).toBe('Madhapur, Hyderabad');
    });

    it('keeps the two directions in separate caches', async () => {
      geocodeAddress.mockResolvedValue({ coordinates: CAPTURE_POINT, formattedAddress: null });
      reverseGeocodeCoordinates.mockResolvedValue({ formattedAddress: 'Madhapur, Hyderabad' });

      await GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration());
      await GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration());

      expect(geocodeAddress).toHaveBeenCalledTimes(1);
      expect(reverseGeocodeCoordinates).toHaveBeenCalledTimes(1);
    });

    it('clearCache drops both directions', async () => {
      geocodeAddress.mockResolvedValue({ coordinates: CAPTURE_POINT, formattedAddress: null });
      reverseGeocodeCoordinates.mockResolvedValue({ formattedAddress: 'Madhapur, Hyderabad' });
      await GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration());
      await GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration());

      GeocodingService.clearCache();
      await GeocodingService.resolveAddressCoordinates(CASE_ADDRESS, buildConfiguration());
      await GeocodingService.resolveCoordinatesAddress(CAPTURE_POINT, buildConfiguration());

      expect(geocodeAddress).toHaveBeenCalledTimes(2);
      expect(reverseGeocodeCoordinates).toHaveBeenCalledTimes(2);
    });
  });
});
