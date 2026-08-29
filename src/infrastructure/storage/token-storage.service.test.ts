import * as Keychain from 'react-native-keychain';
import { STORAGE_TYPE } from 'react-native-keychain';

import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('persists the token under a fixed Keychain service/username pair', async () => {
    await TokenStorageService.saveToken('jwt-token-value');

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('authToken', 'jwt-token-value', {
      service: 'com.fullscan.auth.token',
    });
  });

  it('returns the stored token when Keychain holds credentials', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      username: 'authToken',
      password: 'jwt-token-value',
      service: 'com.fullscan.auth.token',
      storage: STORAGE_TYPE.AES_GCM,
    });

    await expect(TokenStorageService.getToken()).resolves.toBe('jwt-token-value');
  });

  it('returns null when Keychain has no stored entry', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce(false);

    await expect(TokenStorageService.getToken()).resolves.toBeNull();
  });

  it('clears the stored token from Keychain', async () => {
    await TokenStorageService.clearToken();

    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({ service: 'com.fullscan.auth.token' });
  });
});
