import { resolveGeoFenceConfiguration } from './mobile-app-settings';
import type { MobileAppSettings, MobileAppSettingValue } from './reference-data.entity';

function buildSettings(values: Record<string, MobileAppSettingValue>): MobileAppSettings {
  return { values, updatedAt: '2026-09-03 14:17:05' };
}

/**
 * Unlike every other setting, these two are never defaulted — see
 * `resolveGeoFenceConfiguration`'s doc comment for why a guessed radius is
 * worse than refusing access.
 */
describe('resolveGeoFenceConfiguration', () => {
  it('reads both values from the server payload', () => {
    const configuration = resolveGeoFenceConfiguration(
      buildSettings({ geo_fence_radius_meters: 350, locationRetryCount: 5 }),
    );

    expect(configuration).toEqual({ geoFenceRadiusMeters: 350, locationRetryCount: 5 });
  });

  it('accepts numeric strings, as an older backend may send them', () => {
    expect(
      resolveGeoFenceConfiguration(
        buildSettings({ geo_fence_radius_meters: '350', locationRetryCount: '5' }),
      ),
    ).toEqual({ geoFenceRadiusMeters: 350, locationRetryCount: 5 });
  });

  it('returns null before the payload has arrived', () => {
    expect(resolveGeoFenceConfiguration(null)).toBeNull();
    expect(resolveGeoFenceConfiguration(undefined)).toBeNull();
  });

  it('returns null when the radius is missing', () => {
    expect(resolveGeoFenceConfiguration(buildSettings({ locationRetryCount: 3 }))).toBeNull();
  });

  it('returns null when the retry count is missing', () => {
    expect(
      resolveGeoFenceConfiguration(buildSettings({ geo_fence_radius_meters: 200 })),
    ).toBeNull();
  });

  it('returns null for a malformed value rather than falling back to a default', () => {
    expect(
      resolveGeoFenceConfiguration(
        buildSettings({ geo_fence_radius_meters: 'not-a-number', locationRetryCount: 3 }),
      ),
    ).toBeNull();
  });

  it('returns null for values outside the range the back office enforces', () => {
    expect(
      resolveGeoFenceConfiguration(
        buildSettings({ geo_fence_radius_meters: 9999, locationRetryCount: 3 }),
      ),
    ).toBeNull();
    expect(
      resolveGeoFenceConfiguration(
        buildSettings({ geo_fence_radius_meters: 200, locationRetryCount: 99 }),
      ),
    ).toBeNull();
  });
});
