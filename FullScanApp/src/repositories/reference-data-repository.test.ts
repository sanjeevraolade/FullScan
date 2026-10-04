import { apiClient } from '@/infrastructure/networking';
import { KeyValueStorageService } from '@/infrastructure/storage';
import { LoggerService } from '@/infrastructure/logger';
import type { ReferenceData } from '@/domain/reference-data';

import { fetchReferenceData, loadReferenceData } from './reference-data-repository';

jest.mock('@/infrastructure/networking', () => ({
  apiClient: { get: jest.fn() },
}));

/** Fixed by the master-data-sync contract — asserted literally on purpose. */
const CACHE_KEY = 'master-data:v1';

const CACHED_VERSION = '2026-10-04T09:15:02.481Z';
const NEWER_VERSION = '2026-10-04T09:15:02.482Z';
const OLDER_VERSION = '2026-10-04T09:15:02.480Z';

const REFERENCE_DATA: ReferenceData = {
  updatedAt: CACHED_VERSION,
  verificationTypeStatuses: [{ code: 'verified', label: 'Verified' }],
  utvOptions: [{ code: 'door_locked', label: 'Door locked' }],
  insuffOptions: [],
  photoTypes: [{ code: 'house_front', label: 'House front' }],
  componentStatuses: [],
  actionStatuses: [],
  profileStatuses: [],
  mobileAppSettings: {
    values: { geo_fence_radius_meters: 100 },
    updatedAt: '2026-09-01 00:00:00',
  },
};

/** What the server serves after an admin change — distinguishable from the cached copy. */
const UPDATED_REFERENCE_DATA: ReferenceData = {
  ...REFERENCE_DATA,
  updatedAt: NEWER_VERSION,
  photoTypes: [
    { code: 'house_front', label: 'House front' },
    { code: 'door_number', label: 'Door number' },
  ],
};

function mockMasterDataResponse(payload: object): void {
  jest.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: payload } });
}

function seedCache(referenceData: ReferenceData = REFERENCE_DATA): void {
  KeyValueStorageService.setObject(CACHE_KEY, referenceData);
}

function readCache(): unknown {
  return KeyValueStorageService.getObject<unknown>(CACHE_KEY);
}

describe('reference-data-repository', () => {
  beforeEach(() => {
    // MMKV's in-memory mock lives for the whole file — start every test empty.
    KeyValueStorageService.remove(CACHE_KEY);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('fetchReferenceData', () => {
    it('requests GET /master-data — the endpoint that replaced /reference-data', async () => {
      mockMasterDataResponse(REFERENCE_DATA);

      await fetchReferenceData();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith('/master-data');
      expect(apiClient.get).not.toHaveBeenCalledWith('/reference-data');
    });

    it('resolves with the payload, its version and mobileAppSettings included', async () => {
      mockMasterDataResponse(REFERENCE_DATA);

      await expect(fetchReferenceData()).resolves.toEqual(REFERENCE_DATA);
    });

    it('persists the payload under master-data:v1', async () => {
      mockMasterDataResponse(REFERENCE_DATA);

      await fetchReferenceData();

      expect(readCache()).toEqual(REFERENCE_DATA);
    });

    it('replaces an older cached payload with the one it fetched', async () => {
      seedCache(REFERENCE_DATA);
      mockMasterDataResponse(UPDATED_REFERENCE_DATA);

      await fetchReferenceData();

      expect(readCache()).toEqual(UPDATED_REFERENCE_DATA);
    });

    it('maps a missing updatedAt from a server that predates versioning to null', async () => {
      const { updatedAt: _omitted, ...unversionedPayload } = REFERENCE_DATA;
      mockMasterDataResponse(unversionedPayload);

      const referenceData = await fetchReferenceData();

      expect(referenceData.updatedAt).toBeNull();
      expect(readCache()).toEqual({ ...REFERENCE_DATA, updatedAt: null });
    });

    it('keeps only the domain fields, so the cache never holds extra server fields', async () => {
      mockMasterDataResponse({ ...REFERENCE_DATA, futureServerField: 'ignored' });

      await expect(fetchReferenceData()).resolves.toStrictEqual(REFERENCE_DATA);
      expect(readCache()).toStrictEqual(REFERENCE_DATA);
    });

    it('still resolves with the payload when it cannot be persisted', async () => {
      jest.spyOn(KeyValueStorageService, 'setObject').mockImplementationOnce(() => {
        throw new Error('MMKV write failed');
      });
      mockMasterDataResponse(REFERENCE_DATA);

      await expect(fetchReferenceData()).resolves.toEqual(REFERENCE_DATA);
    });

    it('propagates a network failure (offline) and leaves the cache untouched', async () => {
      seedCache(REFERENCE_DATA);
      const networkError = { isAxiosError: true, response: undefined, message: 'Network Error' };
      jest.mocked(apiClient.get).mockRejectedValueOnce(networkError);

      await expect(fetchReferenceData()).rejects.toBe(networkError);
      expect(readCache()).toEqual(REFERENCE_DATA);
    });

    it('propagates a 404 from a server that predates /master-data', async () => {
      const notFoundError = { isAxiosError: true, response: { status: 404 } };
      jest.mocked(apiClient.get).mockRejectedValueOnce(notFoundError);

      await expect(fetchReferenceData()).rejects.toBe(notFoundError);
      expect(readCache()).toBeNull();
    });
  });

  describe('loadReferenceData', () => {
    it('returns the cached payload without a request when the versions match', async () => {
      seedCache(REFERENCE_DATA);

      await expect(loadReferenceData(CACHED_VERSION)).resolves.toEqual(REFERENCE_DATA);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('fetches when the server reports no version, even with a cached payload', async () => {
      seedCache(REFERENCE_DATA);
      mockMasterDataResponse(UPDATED_REFERENCE_DATA);

      await expect(loadReferenceData(null)).resolves.toEqual(UPDATED_REFERENCE_DATA);
      expect(apiClient.get).toHaveBeenCalledWith('/master-data');
    });

    it('fetches when the server reports no version and the cached payload has none either', async () => {
      seedCache({ ...REFERENCE_DATA, updatedAt: null });
      mockMasterDataResponse(REFERENCE_DATA);

      await loadReferenceData(null);

      // null means "unknown", never "matches" — two unknowns don't prove the copy current.
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('fetches and persists when nothing is cached yet', async () => {
      mockMasterDataResponse(REFERENCE_DATA);

      await expect(loadReferenceData(CACHED_VERSION)).resolves.toEqual(REFERENCE_DATA);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(readCache()).toEqual(REFERENCE_DATA);
    });

    it('fetches and replaces the cache when the server version is newer', async () => {
      seedCache(REFERENCE_DATA);
      mockMasterDataResponse(UPDATED_REFERENCE_DATA);

      await expect(loadReferenceData(NEWER_VERSION)).resolves.toEqual(UPDATED_REFERENCE_DATA);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(readCache()).toEqual(UPDATED_REFERENCE_DATA);
    });

    it('fetches when the server version is older than the cached one — equality, not ordering', async () => {
      seedCache(REFERENCE_DATA);
      const restoredPayload: ReferenceData = { ...REFERENCE_DATA, updatedAt: OLDER_VERSION };
      mockMasterDataResponse(restoredPayload);

      await expect(loadReferenceData(OLDER_VERSION)).resolves.toEqual(restoredPayload);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(readCache()).toEqual(restoredPayload);
    });

    it('fetches when the cached payload has no version but the server has one', async () => {
      seedCache({ ...REFERENCE_DATA, updatedAt: null });
      mockMasterDataResponse(REFERENCE_DATA);

      await loadReferenceData(CACHED_VERSION);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('treats an unparseable cache entry as a miss and fetches', async () => {
      KeyValueStorageService.setString(CACHE_KEY, '{"updatedAt":"2026-10-04T09:15:02.481Z", trunc');
      mockMasterDataResponse(REFERENCE_DATA);

      await expect(loadReferenceData(CACHED_VERSION)).resolves.toEqual(REFERENCE_DATA);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(readCache()).toEqual(REFERENCE_DATA);
    });

    it('treats a parseable entry of the wrong shape as a miss, even when its version matches', async () => {
      KeyValueStorageService.setObject(CACHE_KEY, { updatedAt: CACHED_VERSION, photoTypes: [] });
      mockMasterDataResponse(REFERENCE_DATA);

      await expect(loadReferenceData(CACHED_VERSION)).resolves.toEqual(REFERENCE_DATA);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(readCache()).toEqual(REFERENCE_DATA);
    });

    it('rejects on a failed fetch without falling back to the stale cache, and leaves it untouched', async () => {
      seedCache(REFERENCE_DATA);
      const networkError = { isAxiosError: true, response: undefined, message: 'Network Error' };
      jest.mocked(apiClient.get).mockRejectedValueOnce(networkError);

      await expect(loadReferenceData(NEWER_VERSION)).rejects.toBe(networkError);
      expect(readCache()).toEqual(REFERENCE_DATA);
    });

    it('rejects with a server error when nothing is cached', async () => {
      const serverError = { isAxiosError: true, response: { status: 503 } };
      jest.mocked(apiClient.get).mockRejectedValueOnce(serverError);

      await expect(loadReferenceData(CACHED_VERSION)).rejects.toBe(serverError);
      expect(readCache()).toBeNull();
    });

    it('logs the hit with both versions', async () => {
      const infoSpy = jest.spyOn(LoggerService, 'info');
      seedCache(REFERENCE_DATA);

      await loadReferenceData(CACHED_VERSION);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('reference-data-repository.ts: loadReferenceData'),
        { isCacheHit: true, serverUpdatedAt: CACHED_VERSION, cachedUpdatedAt: CACHED_VERSION },
      );
    });

    it.each([
      ['noServerVersion', null, { serverUpdatedAt: null }],
      ['noCache', CACHED_VERSION, { serverUpdatedAt: CACHED_VERSION, cachedUpdatedAt: null }],
      [
        'versionDiffers',
        NEWER_VERSION,
        { serverUpdatedAt: NEWER_VERSION, cachedUpdatedAt: CACHED_VERSION },
      ],
    ] as const)(
      'logs a %s miss with the versions involved',
      async (reason, serverVersion, versions) => {
        const infoSpy = jest.spyOn(LoggerService, 'info');
        if (reason !== 'noCache') {
          seedCache(REFERENCE_DATA);
        }
        mockMasterDataResponse(UPDATED_REFERENCE_DATA);

        await loadReferenceData(serverVersion);

        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining('reference-data-repository.ts: loadReferenceData'),
          { isCacheHit: false, reason, ...versions },
        );
      },
    );

    it('never logs payload contents — option labels or setting values', async () => {
      const infoSpy = jest.spyOn(LoggerService, 'info');
      const warnSpy = jest.spyOn(LoggerService, 'warn');
      const errorSpy = jest.spyOn(LoggerService, 'error');
      seedCache(REFERENCE_DATA);
      mockMasterDataResponse(UPDATED_REFERENCE_DATA);

      await loadReferenceData(CACHED_VERSION);
      await loadReferenceData(NEWER_VERSION);

      const logged = JSON.stringify([
        ...infoSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]);
      expect(logged).not.toContain('Door number');
      expect(logged).not.toContain('House front');
      expect(logged).not.toContain('geo_fence_radius_meters');
    });
  });
});
