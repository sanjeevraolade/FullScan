import * as Keychain from 'react-native-keychain';
import { BIOMETRY_TYPE } from 'react-native-keychain';

import { BiometricsService } from './biometrics.service';

describe('BiometricsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reports faceId for Face ID and Android face recognition', async () => {
    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(BIOMETRY_TYPE.FACE_ID);
    await expect(BiometricsService.getBiometryType()).resolves.toBe('faceId');

    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(BIOMETRY_TYPE.FACE);
    await expect(BiometricsService.getBiometryType()).resolves.toBe('faceId');
  });

  it('reports fingerprint for Touch ID, fingerprint and iris sensors', async () => {
    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(BIOMETRY_TYPE.TOUCH_ID);
    await expect(BiometricsService.getBiometryType()).resolves.toBe('fingerprint');

    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(BIOMETRY_TYPE.FINGERPRINT);
    await expect(BiometricsService.getBiometryType()).resolves.toBe('fingerprint');

    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(BIOMETRY_TYPE.IRIS);
    await expect(BiometricsService.getBiometryType()).resolves.toBe('fingerprint');
  });

  it('reports none when the device has no usable biometry', async () => {
    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(null);
    await expect(BiometricsService.getBiometryType()).resolves.toBe('none');
  });

  it('derives support from the resolved biometry type', async () => {
    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(BIOMETRY_TYPE.FINGERPRINT);
    await expect(BiometricsService.isSupported()).resolves.toBe(true);

    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValueOnce(null);
    await expect(BiometricsService.isSupported()).resolves.toBe(false);
  });
});
