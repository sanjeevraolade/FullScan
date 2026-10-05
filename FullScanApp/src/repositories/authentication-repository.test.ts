import { AxiosError } from 'axios';

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

const MASTER_DATA_UPDATED_AT = '2026-10-04T09:15:02.481Z';

function mockLoginResponse(
  fieldExecutive: Record<string, unknown> = FIELD_EXECUTIVE,
  masterDataUpdatedAt: string | null = MASTER_DATA_UPDATED_AT,
): void {
  jest.mocked(apiClient.post).mockResolvedValueOnce({
    data: { success: true, data: { token: TOKEN, fieldExecutive, masterDataUpdatedAt } },
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

      const { fieldExecutive } = await login(CREDENTIALS);

      expect(fieldExecutive).toEqual(FIELD_EXECUTIVE);
      // The profile replaces the old follow-up `GET /me` — login is one request.
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    it('passes the master-data version through unchanged', async () => {
      mockLoginResponse();

      await expect(login(CREDENTIALS)).resolves.toStrictEqual({
        fieldExecutive: FIELD_EXECUTIVE,
        masterDataUpdatedAt: MASTER_DATA_UPDATED_AT,
      });
    });

    it('keeps a null master-data version (server has none recorded) as null', async () => {
      mockLoginResponse(FIELD_EXECUTIVE, null);

      const { masterDataUpdatedAt } = await login(CREDENTIALS);

      expect(masterDataUpdatedAt).toBeNull();
    });

    it('maps a master-data version missing from an older server to null', async () => {
      jest.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, data: { token: TOKEN, fieldExecutive: FIELD_EXECUTIVE } },
      });

      const { masterDataUpdatedAt } = await login(CREDENTIALS);

      expect(masterDataUpdatedAt).toBeNull();
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

      const { fieldExecutive } = await login(CREDENTIALS);

      expect(fieldExecutive).toStrictEqual(FIELD_EXECUTIVE);
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
    const LOGOUT_RESPONSE = { status: 200, data: { success: true, data: { signedOut: true } } };
    const EXPECTED_LOGOUT_CONFIG = { headers: { Authorization: `Bearer ${TOKEN}` } };

    beforeEach(() => {
      // Persistent defaults rather than *Once values — `clearAllMocks` keeps
      // implementations, so each test overrides only what it needs.
      jest.mocked(TokenStorageService.getToken).mockResolvedValue(TOKEN);
      jest.mocked(TokenStorageService.clearToken).mockResolvedValue(undefined);
      jest.mocked(apiClient.post).mockResolvedValue(LOGOUT_RESPONSE);
    });

    it('clears the persisted session token', async () => {
      await logout();

      expect(TokenStorageService.clearToken).toHaveBeenCalledTimes(1);
    });

    it('posts /auth/logout with the stored token as an explicit bearer header', async () => {
      await logout();

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/logout',
        undefined,
        EXPECTED_LOGOUT_CONFIG,
      );
    });

    it('has cleared the stored token before the logout request is sent', async () => {
      const steps: string[] = [];
      jest.mocked(TokenStorageService.getToken).mockImplementation(async () => {
        steps.push('token read');
        return TOKEN;
      });
      jest.mocked(TokenStorageService.clearToken).mockImplementation(async () => {
        // Completes a tick later: the request must wait for the clear, not just follow its call.
        await Promise.resolve();
        steps.push('token cleared');
      });
      jest.mocked(apiClient.post).mockImplementation(async () => {
        steps.push('logout requested');
        return LOGOUT_RESPONSE;
      });

      await logout();

      expect(steps).toEqual(['token read', 'token cleared', 'logout requested']);
    });

    it('leaves a token saved by a re-login while the logout request is in flight', async () => {
      let storedToken: string | null = TOKEN;
      jest.mocked(TokenStorageService.getToken).mockImplementation(async () => storedToken);
      jest.mocked(TokenStorageService.clearToken).mockImplementation(async () => {
        storedToken = null;
      });
      jest.mocked(apiClient.post).mockImplementation(() => {
        // The user logs in again on the Login screen before this slow request times out.
        storedToken = 'new-session-token';
        return Promise.reject(new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED'));
      });

      await logout();

      expect(storedToken).toBe('new-session-token');
    });

    it.each([
      {
        scenario: 'offline',
        requestError: { isAxiosError: true, response: undefined, code: 'ERR_NETWORK' },
        isAxiosError: true,
        status: undefined,
      },
      {
        scenario: 'timed out',
        requestError: { isAxiosError: true, response: undefined, code: 'ECONNABORTED' },
        isAxiosError: true,
        status: undefined,
      },
      {
        scenario: 'rejected with 401 (already revoked or expired)',
        requestError: { isAxiosError: true, response: { status: 401 } },
        isAxiosError: true,
        status: 401,
      },
      {
        scenario: 'rejected with 500',
        requestError: { isAxiosError: true, response: { status: 500 } },
        isAxiosError: true,
        status: 500,
      },
      {
        scenario: 'failing outside the transport',
        requestError: new Error('Unexpected failure'),
        isAxiosError: false,
        status: undefined,
      },
    ])(
      'resolves when the request is $scenario, logging only the failure kind and status',
      async ({ requestError, isAxiosError, status }) => {
        const warnSpy = jest.spyOn(LoggerService, 'warn');
        jest.mocked(apiClient.post).mockRejectedValueOnce(requestError);

        await expect(logout()).resolves.toBeUndefined();

        expect(TokenStorageService.clearToken).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('revokeServerSession'), {
          isAxiosError,
          status,
        });
        warnSpy.mockRestore();
      },
    );

    it('makes no request and only clears storage when no token is stored', async () => {
      jest.mocked(TokenStorageService.getToken).mockResolvedValue(null);

      await expect(logout()).resolves.toBeUndefined();

      expect(TokenStorageService.clearToken).toHaveBeenCalledTimes(1);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('still clears storage, without a request, when the stored token cannot be read', async () => {
      jest
        .mocked(TokenStorageService.getToken)
        .mockRejectedValue(new Error('Keychain unavailable'));

      await expect(logout()).resolves.toBeUndefined();

      expect(TokenStorageService.clearToken).toHaveBeenCalledTimes(1);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('still revokes the server session when the stored token cannot be cleared', async () => {
      jest
        .mocked(TokenStorageService.clearToken)
        .mockRejectedValue(new Error('Keychain unavailable'));

      await expect(logout()).resolves.toBeUndefined();

      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/logout',
        undefined,
        EXPECTED_LOGOUT_CONFIG,
      );
    });

    it('never logs the token or the server response body', async () => {
      const SERVER_ERROR_MESSAGE = 'Invalid or expired authentication token';
      const infoSpy = jest.spyOn(LoggerService, 'info');
      const warnSpy = jest.spyOn(LoggerService, 'warn');
      const errorSpy = jest.spyOn(LoggerService, 'error');
      jest.mocked(apiClient.post).mockRejectedValueOnce({
        isAxiosError: true,
        message: SERVER_ERROR_MESSAGE,
        config: { headers: { Authorization: `Bearer ${TOKEN}` } },
        response: {
          status: 401,
          data: { success: false, error: { message: SERVER_ERROR_MESSAGE } },
        },
      });

      await logout(); // the queued 401
      await logout(); // the default 200

      const logged = JSON.stringify([
        ...infoSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]);
      expect(logged).toContain('401');
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain('signedOut');
      expect(logged).not.toContain(SERVER_ERROR_MESSAGE);
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
