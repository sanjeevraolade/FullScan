import { act, renderHook } from '@testing-library/react-native';

import { DEFAULT_MOBILE_APP_SETTINGS } from '@/domain/reference-data';
import type { ReferenceData } from '@/domain/reference-data';

import { useReferenceDataStore } from './reference-data.store';
import { getMobileAppSettings, useMobileAppSettings } from './use-mobile-app-settings';

const EMPTY_OPTION_LISTS = {
  verificationTypeStatuses: [],
  utvOptions: [],
  insuffOptions: [],
  photoTypes: [],
  componentStatuses: [],
  actionStatuses: [],
  profileStatuses: [],
} as const;

function buildReferenceData(
  values: Record<string, boolean | number | string>,
  updatedAt: string | null = null,
): ReferenceData {
  return { ...EMPTY_OPTION_LISTS, mobileAppSettings: { values, updatedAt } };
}

function seedSettings(
  values: Record<string, boolean | number | string>,
  updatedAt: string | null = null,
): void {
  useReferenceDataStore.setState({ referenceData: buildReferenceData(values, updatedAt) });
}

describe('useMobileAppSettings', () => {
  afterEach(() => {
    useReferenceDataStore.setState({ referenceData: null });
  });

  it('returns the safe defaults before reference data has been fetched', async () => {
    const { result } = await renderHook(() => useMobileAppSettings());

    expect(result.current).toMatchObject(DEFAULT_MOBILE_APP_SETTINGS);
  });

  it('returns the server-supplied settings once reference data is in the store', async () => {
    seedSettings({ geo_fence_radius_meters: 450, sync_on_wifi_only: true }, '2026-09-03 12:00:00');

    const { result } = await renderHook(() => useMobileAppSettings());

    expect(result.current.geoFenceRadiusMeters).toBe(450);
    expect(result.current.isSyncOnWifiOnly).toBe(true);
    expect(result.current.updatedAt).toBe('2026-09-03 12:00:00');
  });

  it('still defaults the settings the payload omits', async () => {
    seedSettings({ geo_fence_radius_meters: 450 });

    const { result } = await renderHook(() => useMobileAppSettings());

    expect(result.current.photoCompressionQuality).toBe(
      DEFAULT_MOBILE_APP_SETTINGS.photoCompressionQuality,
    );
  });

  it('re-resolves when the store receives updated settings', async () => {
    seedSettings({ geo_fence_radius_meters: 200 });

    const { result } = await renderHook(() => useMobileAppSettings());
    expect(result.current.geoFenceRadiusMeters).toBe(200);

    await act(async () => {
      seedSettings({ geo_fence_radius_meters: 900 });
    });

    expect(result.current.geoFenceRadiusMeters).toBe(900);
  });

  it('returns a stable object while the settings are unchanged', async () => {
    seedSettings({ geo_fence_radius_meters: 200 });

    const { result, rerender } = await renderHook(() => useMobileAppSettings());
    const first = result.current;

    await rerender({});

    expect(result.current).toBe(first);
  });

  it('falls back to the defaults when the session ends', async () => {
    seedSettings({ geo_fence_radius_meters: 450 });

    const { result } = await renderHook(() => useMobileAppSettings());
    expect(result.current.geoFenceRadiusMeters).toBe(450);

    await act(async () => {
      useReferenceDataStore.getState().clearReferenceData();
    });

    expect(result.current.geoFenceRadiusMeters).toBe(
      DEFAULT_MOBILE_APP_SETTINGS.geoFenceRadiusMeters,
    );
  });
});

describe('getMobileAppSettings', () => {
  afterEach(() => {
    useReferenceDataStore.setState({ referenceData: null });
  });

  it('reads the current settings outside React', () => {
    seedSettings({ offline_queue_retry_limit: 9 });

    expect(getMobileAppSettings().offlineQueueRetryLimit).toBe(9);
  });

  it('returns the defaults when there is no reference data', () => {
    expect(getMobileAppSettings()).toMatchObject(DEFAULT_MOBILE_APP_SETTINGS);
  });
});
