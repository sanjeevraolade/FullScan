import type { BiometryType } from './biometrics.types';

export interface IBiometricsService {
  isSupported(): Promise<boolean>;
  getBiometryType(): Promise<BiometryType>;
}
