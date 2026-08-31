import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { LoggerService } from '@/infrastructure/logger';
import { BiometricsService } from '@/infrastructure/biometrics';
import type { BiometryType } from '@/infrastructure/biometrics';
import { BiometricCredentialStorageService, TokenStorageService } from '@/infrastructure/storage';
import { login } from '@/repositories/authentication-repository';
import { fetchCurrentFieldExecutive } from '@/repositories/field-executive-repository';
import { fetchReferenceData } from '@/repositories/reference-data-repository';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import { useSessionStore } from '@/store/session';
import { useReferenceDataStore } from '@/store/reference-data';

const FILE_NAME = 'use-biometric-login.ts';

export type BiometricLoginErrorKey = 'authenticationFailed' | 'network' | 'serverUnavailable';

export interface UseBiometricLoginResult {
  /** True once the device supports biometrics and a vault entry exists to unlock. */
  readonly isAvailable: boolean;
  readonly biometryType: BiometryType;
  readonly isAuthenticating: boolean;
  readonly biometricLoginError: BiometricLoginErrorKey | null;
  loginWithBiometrics(): void;
}

function resolveBiometricLoginErrorKey(error: unknown): BiometricLoginErrorKey {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) {
      return 'authenticationFailed';
    }
    return status !== undefined && status >= 500 ? 'serverUnavailable' : 'network';
  }
  return 'network';
}

/** Fetches the profile + reference data and populates the app-wide stores — mirrors the post-login step in `useLoginForm`. */
async function restoreSession(): Promise<void> {
  const [fieldExecutive, referenceData] = await Promise.all([
    fetchCurrentFieldExecutive(),
    fetchReferenceData(),
  ]);
  useSessionStore.getState().setFieldExecutive(fieldExecutive);
  useReferenceDataStore.getState().setReferenceData(referenceData);
}

/**
 * Drives the Login screen's biometric icon: resolves whether to show it and
 * which type, then on tap verifies the user via the OS biometric prompt and
 * restores their session from the stored token — falling back to a silent
 * re-login with the stored password if that token has since expired.
 */
export function useBiometricLogin(): UseBiometricLoginResult {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>('none');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricLoginError, setBiometricLoginError] = useState<BiometricLoginErrorKey | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    async function resolveAvailability(): Promise<void> {
      const [resolvedBiometryType, hasEnrollment] = await Promise.all([
        BiometricsService.getBiometryType(),
        BiometricCredentialStorageService.exists(),
      ]);
      if (!isMounted) {
        return;
      }
      const deviceSupportsBiometrics = resolvedBiometryType !== 'none';
      LoggerService.info(`${FILE_NAME}: useBiometricLogin: resolved biometric login availability`, {
        isAvailable: deviceSupportsBiometrics && hasEnrollment,
        biometryType: resolvedBiometryType,
      });
      setIsAvailable(deviceSupportsBiometrics && hasEnrollment);
      setBiometryType(resolvedBiometryType);
    }
    void resolveAvailability();
    return () => {
      isMounted = false;
    };
  }, []);

  const loginWithBiometrics = useCallback(() => {
    LoggerService.info(
      `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: biometric login requested`,
    );
    void (async () => {
      setBiometricLoginError(null);
      setIsAuthenticating(true);
      try {
        const credentials = await BiometricCredentialStorageService.retrieve(
          t('login.biometric.login.promptTitle'),
        );
        if (!credentials) {
          // Prompt cancelled/failed or nothing stored — the vault itself may
          // still be valid, so leave it intact and let the user retry.
          LoggerService.warn(
            `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: biometric verification failed`,
          );
          setBiometricLoginError('authenticationFailed');
          return;
        }

        await TokenStorageService.saveToken(credentials.token);
        try {
          await restoreSession();
        } catch (error: unknown) {
          if (!axios.isAxiosError(error) || error.response?.status !== 401) {
            // Network/server failure — not proof the stored credentials are
            // bad, so the vault stays intact for the next attempt.
            throw error;
          }
          LoggerService.warn(
            `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: stored token expired, re-authenticating with stored password`,
          );
          try {
            await login({ username: credentials.username, password: credentials.password });
          } catch (loginError: unknown) {
            // The stored password itself no longer works (e.g. changed
            // server-side) — fail securely, this vault entry can't recover.
            LoggerService.warn(
              `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: stored password rejected, clearing vault`,
            );
            await BiometricCredentialStorageService.clear();
            setIsAvailable(false);
            throw loginError;
          }
          await restoreSession();
        }

        LoggerService.info(
          `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: biometric login succeeded`,
        );
        navigation.replace(ROUTE_NAMES.MAIN);
      } catch (error: unknown) {
        const errorKey = resolveBiometricLoginErrorKey(error);
        LoggerService.error(
          `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: biometric login failed`,
          {
            errorKey,
          },
        );
        setBiometricLoginError(errorKey);
      } finally {
        setIsAuthenticating(false);
      }
    })();
  }, [navigation, t]);

  return { isAvailable, biometryType, isAuthenticating, biometricLoginError, loginWithBiometrics };
}
