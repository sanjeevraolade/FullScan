import type { AxiosRequestConfig, AxiosResponse } from 'axios';

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
});
