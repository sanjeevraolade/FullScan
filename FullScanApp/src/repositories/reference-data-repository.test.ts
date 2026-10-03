import { apiClient } from '@/infrastructure/networking';
import type { ReferenceData } from '@/domain/reference-data';

import { fetchReferenceData } from './reference-data-repository';

jest.mock('@/infrastructure/networking', () => ({
  apiClient: { get: jest.fn() },
}));

const REFERENCE_DATA: ReferenceData = {
  verificationTypeStatuses: [{ code: 'verified', label: 'Verified' }],
  utvOptions: [{ code: 'door_locked', label: 'Door locked' }],
  insuffOptions: [],
  photoTypes: [{ code: 'house_front', label: 'House front' }],
  componentStatuses: [],
  actionStatuses: [],
  profileStatuses: [],
  mobileAppSettings: {
    values: { geo_fence_radius_meters: 100 },
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
};

describe('reference-data-repository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchReferenceData', () => {
    it('requests GET /master-data — the endpoint that replaced /reference-data', async () => {
      jest
        .mocked(apiClient.get)
        .mockResolvedValueOnce({ data: { success: true, data: REFERENCE_DATA } });

      await fetchReferenceData();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith('/master-data');
      expect(apiClient.get).not.toHaveBeenCalledWith('/reference-data');
    });

    it('resolves with the payload, mobileAppSettings included', async () => {
      jest
        .mocked(apiClient.get)
        .mockResolvedValueOnce({ data: { success: true, data: REFERENCE_DATA } });

      await expect(fetchReferenceData()).resolves.toEqual(REFERENCE_DATA);
    });

    it('propagates a network failure (offline) so the caller can offer a retry', async () => {
      const networkError = { isAxiosError: true, response: undefined, message: 'Network Error' };
      jest.mocked(apiClient.get).mockRejectedValueOnce(networkError);

      await expect(fetchReferenceData()).rejects.toBe(networkError);
    });

    it('propagates a 404 from a server that predates /master-data', async () => {
      const notFoundError = { isAxiosError: true, response: { status: 404 } };
      jest.mocked(apiClient.get).mockRejectedValueOnce(notFoundError);

      await expect(fetchReferenceData()).rejects.toBe(notFoundError);
    });
  });
});
