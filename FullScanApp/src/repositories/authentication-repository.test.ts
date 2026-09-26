import { apiClient } from '@/infrastructure/networking';
import { TokenStorageService } from '@/infrastructure/storage';
import { getDeviceId, getDeviceInfo } from '@/infrastructure/device';

import { login, logout } from './authentication-repository';

jest.mock('@/infrastructure/networking', () => ({
  apiClient: { post: jest.fn() },
}));
jest.mock('@/infrastructure/storage', () => ({
  TokenStorageService: { saveToken: jest.fn(), getToken: jest.fn(), clearToken: jest.fn() },
}));
jest.mock('@/infrastructure/device', () => ({
  getDeviceId: jest.fn(),
  getDeviceInfo: jest.fn(),
}));

const CREDENTIALS = { username: 'field.executive', password: 'secret-value' };

const mockDeviceInfo = {
  deviceName: 'Test Device',
  model: 'test-model',
  brand: 'test-brand',
  osVersion: '14.0',
  appVersion: '1.0.0',
  systemName: 'iOS',
  uniqueId: 'unique-device-id-123',
};

describe('authentication-repository', () => {
  beforeEach(() => {
    jest.mocked(getDeviceId).mockResolvedValue(mockDeviceInfo.uniqueId);
    jest.mocked(getDeviceInfo).mockResolvedValue(mockDeviceInfo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('posts credentials to /auth/login and persists the returned token', async () => {
      jest.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            token: 'jwt-token-value',
            fieldExecutive: { id: 'fe-001', name: 'Amit Verma', email: 'amit.verma@fullscan.example', role: 'Field Agent' },
          },
        },
      });

      await login(CREDENTIALS);

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        username: CREDENTIALS.username,
        password: CREDENTIALS.password,
        deviceId: mockDeviceInfo.uniqueId,
        deviceDetails: mockDeviceInfo,
      });
      expect(TokenStorageService.saveToken).toHaveBeenCalledWith('jwt-token-value');
    });

    it('propagates the request failure without persisting a token', async () => {
      const requestError = new Error('Request failed with status code 401');
      jest.mocked(apiClient.post).mockRejectedValueOnce(requestError);

      await expect(login(CREDENTIALS)).rejects.toBe(requestError);
      expect(TokenStorageService.saveToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the persisted session token', async () => {
      await logout();

      expect(TokenStorageService.clearToken).toHaveBeenCalled();
    });
  });
});
