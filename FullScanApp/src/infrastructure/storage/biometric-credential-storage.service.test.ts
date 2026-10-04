import * as Keychain from 'react-native-keychain';
import { STORAGE_TYPE } from 'react-native-keychain';

import { BiometricCredentialStorageService } from './biometric-credential-storage.service';

const CREDENTIALS = { username: 'field.executive', password: 'secret-value' };

describe('BiometricCredentialStorageService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('persists the username and password under a biometric access control', async () => {
    await BiometricCredentialStorageService.save(CREDENTIALS);

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'field.executive',
      'secret-value',
      expect.objectContaining({
        service: 'com.fullscan.auth.biometric',
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      }),
    );
  });

  it('titles the save prompt when one is given', async () => {
    await BiometricCredentialStorageService.save(CREDENTIALS, 'Confirm to update biometric login');

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'field.executive',
      'secret-value',
      expect.objectContaining({
        authenticationPrompt: { title: 'Confirm to update biometric login' },
      }),
    );
  });

  it('returns the stored credentials after a successful biometric prompt', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      username: 'field.executive',
      password: 'secret-value',
      service: 'com.fullscan.auth.biometric',
      storage: STORAGE_TYPE.AES_GCM,
    });

    await expect(
      BiometricCredentialStorageService.retrieve('Log in with biometrics'),
    ).resolves.toEqual(CREDENTIALS);
  });

  it('discards and clears a legacy JSON-encoded entry instead of returning it', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      username: 'field.executive',
      password: JSON.stringify({ password: 'secret-value', token: 'jwt-token-value' }),
      service: 'com.fullscan.auth.biometric',
      storage: STORAGE_TYPE.AES_GCM,
    });

    await expect(
      BiometricCredentialStorageService.retrieve('Log in with biometrics'),
    ).resolves.toBeNull();
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'com.fullscan.auth.biometric',
    });
  });

  it('returns null when no biometric credentials are stored', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce(false);

    await expect(
      BiometricCredentialStorageService.retrieve('Log in with biometrics'),
    ).resolves.toBeNull();
  });

  it('returns null when the biometric prompt fails or is cancelled', async () => {
    jest.mocked(Keychain.getGenericPassword).mockRejectedValueOnce(new Error('User cancelled'));

    await expect(
      BiometricCredentialStorageService.retrieve('Log in with biometrics'),
    ).resolves.toBeNull();
  });

  it('clears the biometric vault', async () => {
    await BiometricCredentialStorageService.clear();

    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'com.fullscan.auth.biometric',
    });
  });

  it('reports whether biometric credentials exist without prompting', async () => {
    jest.mocked(Keychain.hasGenericPassword).mockResolvedValueOnce(true);
    await expect(BiometricCredentialStorageService.exists()).resolves.toBe(true);

    expect(Keychain.getGenericPassword).not.toHaveBeenCalled();
  });
});
