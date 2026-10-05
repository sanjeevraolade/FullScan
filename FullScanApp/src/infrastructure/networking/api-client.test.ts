import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import { LoggerService } from '@/infrastructure/logger';
import { TokenStorageService } from '@/infrastructure/storage';

import { apiClient } from './api-client';

jest.mock('@/infrastructure/storage', () => ({
  TokenStorageService: { getToken: jest.fn() },
}));

/** Captures the fully-resolved request config instead of hitting the network. */
function installCapturingAdapter(): { capturedConfig: AxiosRequestConfig | undefined } {
  const captured: { capturedConfig: AxiosRequestConfig | undefined } = { capturedConfig: undefined };
  apiClient.defaults.adapter = (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    captured.capturedConfig = config;
    return Promise.resolve({
      data: { success: true, data: {} },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse);
  };
  return captured;
}

describe('apiClient', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('attaches a Bearer authorization header when a token is stored', async () => {
    jest.mocked(TokenStorageService.getToken).mockResolvedValueOnce('jwt-token-value');
    const captured = installCapturingAdapter();

    await apiClient.get('/me');

    expect(captured.capturedConfig?.headers?.['Authorization']).toBe('Bearer jwt-token-value');
  });

  it('omits the authorization header when no token is stored', async () => {
    jest.mocked(TokenStorageService.getToken).mockResolvedValueOnce(null);
    const captured = installCapturingAdapter();

    await apiClient.get('/me');

    expect(captured.capturedConfig?.headers?.['Authorization']).toBeUndefined();
  });

  // Persistent (not *Once) token values below: with a caller-supplied header the
  // interceptor may never read storage, and `clearAllMocks` would keep an unread
  // *Once value queued for the next test.
  it('keeps a caller-supplied authorization header instead of the stored token', async () => {
    jest.mocked(TokenStorageService.getToken).mockResolvedValue('stored-token-value');
    const captured = installCapturingAdapter();

    await apiClient.post('/auth/logout', undefined, {
      headers: { Authorization: 'Bearer caller-token-value' },
    });

    expect(captured.capturedConfig?.headers?.['Authorization']).toBe('Bearer caller-token-value');
  });

  it('does not log a request with a caller-supplied authorization header as unauthenticated', async () => {
    jest.mocked(TokenStorageService.getToken).mockResolvedValue(null);
    const infoSpy = jest.spyOn(LoggerService, 'info');
    const warnSpy = jest.spyOn(LoggerService, 'warn');
    installCapturingAdapter();

    await apiClient.post('/auth/logout', undefined, {
      headers: { Authorization: 'Bearer caller-token-value' },
    });

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('unauthenticated request'),
      expect.anything(),
    );
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('apiClient: request'), {
      method: 'post',
      url: '/auth/logout',
      isAuthenticated: true,
    });
    const logged = JSON.stringify([...infoSpy.mock.calls, ...warnSpy.mock.calls]);
    expect(logged).not.toContain('caller-token-value');
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('still attaches the stored token when the caller sets other headers but no authorization', async () => {
    jest.mocked(TokenStorageService.getToken).mockResolvedValue('stored-token-value');
    const captured = installCapturingAdapter();

    await apiClient.get('/me', { headers: { Accept: 'application/json' } });

    expect(captured.capturedConfig?.headers?.['Authorization']).toBe('Bearer stored-token-value');
  });
});
