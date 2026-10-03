import { apiClient } from '@/infrastructure/networking';
import { TokenStorageService } from '@/infrastructure/storage';
import { getDeviceId, getDeviceInfo } from '@/infrastructure/device';
import { LoggerService } from '@/infrastructure/logger';

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

const TOKEN = 'jwt-token-value';

const FIELD_EXECUTIVE = {
  id: 'fe-001',
  name: 'Amit Verma',
  email: 'amit.verma@fullscan.example',
  role: 'Field Agent',
};

function mockLoginResponse(fieldExecutive: Record<string, unknown> = FIELD_EXECUTIVE): void {
  jest.mocked(apiClient.post).mockResolvedValueOnce({
    data: { success: true, data: { token: TOKEN, fieldExecutive } },
  });
}

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
      mockLoginResponse();

      await login(CREDENTIALS);

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        username: CREDENTIALS.username,
        password: CREDENTIALS.password,
        deviceId: mockDeviceInfo.uniqueId,
        deviceDetails: mockDeviceInfo,
      });
      expect(TokenStorageService.saveToken).toHaveBeenCalledWith(TOKEN);
    });

    it('resolves with the field executive profile carried by the login response', async () => {
      mockLoginResponse();

      await expect(login(CREDENTIALS)).resolves.toEqual(FIELD_EXECUTIVE);
      // The profile replaces the old follow-up `GET /me` — login is one request.
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    it('resolves only after the token has been stored', async () => {
      let isTokenStored = false;
      jest.mocked(TokenStorageService.saveToken).mockImplementationOnce(async () => {
        isTokenStored = true;
      });
      mockLoginResponse();

      await login(CREDENTIALS);

      expect(isTokenStored).toBe(true);
    });

    it('maps only the domain fields, dropping anything else the server sends', async () => {
      mockLoginResponse({ ...FIELD_EXECUTIVE, deviceId: 'device-123', passwordHash: 'hash' });

      await expect(login(CREDENTIALS)).resolves.toStrictEqual(FIELD_EXECUTIVE);
    });

    it('rejects without a profile when the token cannot be persisted', async () => {
      const storageError = new Error('Keychain unavailable');
      jest.mocked(TokenStorageService.saveToken).mockRejectedValueOnce(storageError);
      mockLoginResponse();

      await expect(login(CREDENTIALS)).rejects.toBe(storageError);
    });

    it('rejects without persisting a token when the response carries no profile', async () => {
      jest.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, data: { token: TOKEN } },
      });

      await expect(login(CREDENTIALS)).rejects.toThrow();
      expect(TokenStorageService.saveToken).not.toHaveBeenCalled();
    });

    it('never logs the name, email, token or credentials', async () => {
      const infoSpy = jest.spyOn(LoggerService, 'info');
      const warnSpy = jest.spyOn(LoggerService, 'warn');
      const errorSpy = jest.spyOn(LoggerService, 'error');
      mockLoginResponse();

      await login(CREDENTIALS);

      const logged = JSON.stringify([
        ...infoSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]);
      expect(logged).toContain(FIELD_EXECUTIVE.id);
      expect(logged).not.toContain(FIELD_EXECUTIVE.name);
      expect(logged).not.toContain(FIELD_EXECUTIVE.email);
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain(CREDENTIALS.username);
      expect(logged).not.toContain(CREDENTIALS.password);
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
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
