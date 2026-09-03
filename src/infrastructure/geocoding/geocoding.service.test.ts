import { ConnectivityService } from '@/infrastructure/networking';
import { KeyValueStorageService } from '@/infrastructure/storage';

import { GeocodingService, registerGeocodingProvider } from './geocoding.service';
import { GeocodingFailedError } from './geocoding.errors';
import type { GeocodedAddress, IGeocodingProvider } from './geocoding-provider.interface';
import type { GeocodingProviderConfiguration } from './geocoding.types';

jest.mock('@/infrastructure/networking', () => ({
  ConnectivityService: { isConnected: jest.fn() },
}));

const CASE_ADDRESS = 'Flat 204, Madhapur, Hyderabad';
const TEST_PROVIDER_NAME = 'test-provider';

const geocodeAddress = jest.fn<
  Promise<GeocodedAddress | null>,
  [string, GeocodingProviderConfiguration]
>();
const isConfigured = jest.fn<boolean, [GeocodingProviderConfiguration]>();

const testProvider: IGeocodingProvider = {
  name: TEST_PROVIDER_NAME,
  isConfigured: (configuration) => isConfigured(configuration),
  geocodeAddress: (address, configuration) => geocodeAddress(address, configuration),
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
});
