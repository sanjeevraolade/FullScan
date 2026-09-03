import * as Keychain from 'react-native-keychain';

import { LoggerService } from '@/infrastructure/logger';

import type { IBiometricsService } from './biometrics.interface';
import type { BiometryType } from './biometrics.types';

const FILE_NAME = 'infrastructure/biometrics/biometrics.service.ts';

/**
 * Maps the platform's reported biometry to the two icon states the app
 * distinguishes between — Face ID/Face recognition vs. any fingerprint-style
 * sensor (Touch ID, Android fingerprint, iris). Anything unrecognized or
 * `null` (no enrollment) maps to 'none'.
 */
function mapBiometryType(biometryType: Keychain.BIOMETRY_TYPE | null): BiometryType {
  // The sensor kind is a capability flag, not a biometric payload — safe to log.
  LoggerService.info(`${FILE_NAME}: mapBiometryType: mapping platform biometry`, {
    platformBiometryType: biometryType,
  });
  switch (biometryType) {
    case Keychain.BIOMETRY_TYPE.FACE_ID:
    case Keychain.BIOMETRY_TYPE.FACE:
      LoggerService.info(`${FILE_NAME}: mapBiometryType: mapped to faceId`);
      return 'faceId';
    case Keychain.BIOMETRY_TYPE.TOUCH_ID:
    case Keychain.BIOMETRY_TYPE.FINGERPRINT:
    case Keychain.BIOMETRY_TYPE.IRIS:
    case Keychain.BIOMETRY_TYPE.OPTIC_ID:
      LoggerService.info(`${FILE_NAME}: mapBiometryType: mapped to fingerprint`);
      return 'fingerprint';
    default:
      LoggerService.warn(`${FILE_NAME}: mapBiometryType: no usable biometry enrolled`);
      return 'none';
  }
}

async function getBiometryType(): Promise<BiometryType> {
  LoggerService.info(`${FILE_NAME}: getBiometryType: resolving device biometry`);
  const supportedBiometryType = await Keychain.getSupportedBiometryType();
  const biometryType = mapBiometryType(supportedBiometryType);
  LoggerService.info(`${FILE_NAME}: getBiometryType: resolved device biometry`, { biometryType });
  return biometryType;
}

async function isSupported(): Promise<boolean> {
  LoggerService.info(`${FILE_NAME}: isSupported: checking device biometry support`);
  const biometryType = await getBiometryType();
  const isBiometrySupported = biometryType !== 'none';
  LoggerService.info(`${FILE_NAME}: isSupported: biometry support resolved`, {
    isBiometrySupported,
  });
  return isBiometrySupported;
}

/**
 * Device biometry capability — the one place that wraps
 * `Keychain.getSupportedBiometryType()` so features read "does this device
 * support Face ID/fingerprint" through `infrastructure/` instead of
 * importing react-native-keychain directly.
 */
export const BiometricsService: IBiometricsService = { isSupported, getBiometryType };
