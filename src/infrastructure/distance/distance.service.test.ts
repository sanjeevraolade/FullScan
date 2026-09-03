import { DirectionsDistanceService } from './directions-distance.service';
import { DistanceService } from './distance.service';
import { LocalDistanceService } from './local-distance.service';
import type { DirectionsProviderConfiguration, DistanceRequest } from './distance.types';

const REQUEST: DistanceRequest = {
  from: { latitude: 17.4452, longitude: 78.3821 },
  to: { latitude: 17.4461, longitude: 78.3821 },
};

function buildDirectionsConfiguration(
  overrides: Partial<DirectionsProviderConfiguration> = {},
): DirectionsProviderConfiguration {
  return { providerName: 'google', apiKey: 'test-key', baseUrl: '', ...overrides };
}

describe('LocalDistanceService', () => {
  it('reports the local method and a plausible metre distance', async () => {
    const result = await LocalDistanceService.calculateDistance(REQUEST);

    expect(result.distanceMethod).toBe('local');
    expect(result.distanceMeters).toBeGreaterThan(95);
    expect(result.distanceMeters).toBeLessThan(105);
    expect(result.durationSeconds).toBeNull();
  });
});

/**
 * The fallback policy is the point of these tests: a geo-fence decision must
 * survive every possible routing-API outcome.
 */
describe('DistanceService.measureDistance', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the local calculation when no directions configuration is supplied', async () => {
    const routeSpy = jest.spyOn(DirectionsDistanceService, 'calculateRouteDistance');

    const result = await DistanceService.measureDistance(REQUEST);

    expect(result.distanceMethod).toBe('local');
    expect(routeSpy).not.toHaveBeenCalled();
  });

  it('uses the route distance when the provider is configured and answers', async () => {
    jest.spyOn(DirectionsDistanceService, 'isConfigured').mockReturnValue(true);
    jest.spyOn(DirectionsDistanceService, 'calculateRouteDistance').mockResolvedValue({
      distanceMeters: 480,
      distanceMethod: 'directions',
      calculatedAt: new Date(),
      durationSeconds: 120,
    });

    const result = await DistanceService.measureDistance(REQUEST, {
      directionsConfiguration: buildDirectionsConfiguration(),
    });

    expect(result.distanceMethod).toBe('directions');
    expect(result.distanceMeters).toBe(480);
  });

  it('falls back to the local calculation when the routing API fails', async () => {
    jest.spyOn(DirectionsDistanceService, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(DirectionsDistanceService, 'calculateRouteDistance')
      .mockRejectedValue(new Error('directions provider status OVER_QUERY_LIMIT'));

    const result = await DistanceService.measureDistance(REQUEST, {
      directionsConfiguration: buildDirectionsConfiguration(),
    });

    expect(result.distanceMethod).toBe('local');
    expect(result.distanceMeters).toBeGreaterThan(0);
  });

  it('falls back to the local calculation when the routing API times out', async () => {
    jest.spyOn(DirectionsDistanceService, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(DirectionsDistanceService, 'calculateRouteDistance')
      .mockRejectedValue(
        Object.assign(new Error('timeout of 6000ms exceeded'), { code: 'ECONNABORTED' }),
      );

    const result = await DistanceService.measureDistance(REQUEST, {
      directionsConfiguration: buildDirectionsConfiguration(),
    });

    expect(result.distanceMethod).toBe('local');
  });

  it('falls back to the local calculation when there is no network at all', async () => {
    jest.spyOn(DirectionsDistanceService, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(DirectionsDistanceService, 'calculateRouteDistance')
      .mockRejectedValue(new Error('Network Error'));

    const result = await DistanceService.measureDistance(REQUEST, {
      directionsConfiguration: buildDirectionsConfiguration(),
    });

    expect(result.distanceMethod).toBe('local');
  });

  it('skips the routing API entirely when it has no credentials', async () => {
    const routeSpy = jest.spyOn(DirectionsDistanceService, 'calculateRouteDistance');

    const result = await DistanceService.measureDistance(REQUEST, {
      directionsConfiguration: buildDirectionsConfiguration({ apiKey: '' }),
    });

    expect(result.distanceMethod).toBe('local');
    expect(routeSpy).not.toHaveBeenCalled();
  });

  it('measureLocalDistance never touches the routing API', async () => {
    const routeSpy = jest.spyOn(DirectionsDistanceService, 'calculateRouteDistance');

    const result = await DistanceService.measureLocalDistance(REQUEST);

    expect(result.distanceMethod).toBe('local');
    expect(routeSpy).not.toHaveBeenCalled();
  });
});

describe('DirectionsDistanceService.isConfigured', () => {
  it('requires a non-blank API key', () => {
    expect(DirectionsDistanceService.isConfigured(buildDirectionsConfiguration())).toBe(true);
    expect(
      DirectionsDistanceService.isConfigured(buildDirectionsConfiguration({ apiKey: '  ' })),
    ).toBe(false);
  });
});
