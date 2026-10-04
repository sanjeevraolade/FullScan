import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { LoggerService } from '@/infrastructure/logger';
import { BiometricsService } from '@/infrastructure/biometrics';
import type { BiometryType } from '@/infrastructure/biometrics';
import { BiometricCredentialStorageService } from '@/infrastructure/storage';
import { login } from '@/repositories/authentication-repository';
import type { LoginResult } from '@/repositories/authentication-repository';
import { loadReferenceData } from '@/repositories/reference-data-repository';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import { useSessionStore } from '@/store/session';
import { useReferenceDataStore } from '@/store/reference-data';

const FILE_NAME = 'use-biometric-login.ts';

export type BiometricLoginErrorKey =
  | 'authenticationFailed'
  | 'deviceMismatch'
  | 'network'
  | 'serverUnavailable';

export interface UseBiometricLoginResult {
  /** True once the device supports biometrics and a vault entry exists to unlock. */
  readonly isAvailable: boolean;
  readonly biometryType: BiometryType;
  readonly isAuthenticating: boolean;
  readonly biometricLoginError: BiometricLoginErrorKey | null;
  loginWithBiometrics(): void;
}

function resolveBiometricLoginErrorKey(error: unknown): BiometricLoginErrorKey {
  // Only the failure shape is logged — never the error body or any credential.
  LoggerService.info(`${FILE_NAME}: resolveBiometricLoginErrorKey: resolving failure`, {
    isAxiosError: axios.isAxiosError(error),
  });
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) {
      LoggerService.warn(
        `${FILE_NAME}: resolveBiometricLoginErrorKey: unauthorized — authentication failed`,
        { status },
      );
      return 'authenticationFailed';
    }
    if (status === 403) {
      // Device binding refused the vault's account on this device — usually a
      // vault left by another account. The next password login refreshes it.
      LoggerService.warn(
        `${FILE_NAME}: resolveBiometricLoginErrorKey: forbidden — device binding mismatch`,
        { status },
      );
      return 'deviceMismatch';
    }
    const errorKey: BiometricLoginErrorKey =
      status !== undefined && status >= 500 ? 'serverUnavailable' : 'network';
    LoggerService.warn(`${FILE_NAME}: resolveBiometricLoginErrorKey: mapped axios failure`, {
      status,
      errorKey,
    });
    return errorKey;
  }
  LoggerService.warn(`${FILE_NAME}: resolveBiometricLoginErrorKey: mapped non-axios failure`, {
    errorKey: 'network',
  });
  return 'network';
}

/**
 * Loads reference data — from the device cache when the login's master-data
 * version matches it, otherwise from the network — then populates the
 * app-wide stores with it and the profile `login()` already returned. Mirrors
 * the post-login step in `useLoginForm`.
 */
async function restoreSession(loginResult: LoginResult): Promise<void> {
  const { fieldExecutive, masterDataUpdatedAt } = loginResult;
  LoggerService.info(`${FILE_NAME}: restoreSession: loading reference data`, {
    fieldExecutiveId: fieldExecutive.id,
    masterDataUpdatedAt,
  });
  const referenceData = await loadReferenceData(masterDataUpdatedAt);
  // Configuration before session — see the same ordering note in
  // `useLoginForm`: the session is what triggers location validation, which
  // reads `mobileAppSettings`.
  useReferenceDataStore.getState().setReferenceData(referenceData);
  useSessionStore.getState().setFieldExecutive(fieldExecutive);
  LoggerService.info(`${FILE_NAME}: restoreSession: stores populated`);
}

/**
 * Drives the Login screen's biometric icon: resolves whether to show it and
 * which type, then on tap verifies the user via the OS biometric prompt and
 * re-authenticates through `/auth/login` with the stored username/password —
 * never the cached token, since that may already have expired server-side
 * and trying it first would just cost a guaranteed-failing round trip.
 */
export function useBiometricLogin(): UseBiometricLoginResult {
  LoggerService.info(`${FILE_NAME}: useBiometricLogin: initializing biometric login`);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>('none');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricLoginError, setBiometricLoginError] = useState<BiometricLoginErrorKey | null>(
    null,
  );

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: useBiometricLogin: availability effect running`);
    let isMounted = true;
    async function resolveAvailability(): Promise<void> {
      LoggerService.info(
        `${FILE_NAME}: useBiometricLogin.resolveAvailability: checking device support and vault`,
      );
      const [resolvedBiometryType, hasEnrollment] = await Promise.all([
        BiometricsService.getBiometryType(),
        BiometricCredentialStorageService.exists(),
      ]);
      if (!isMounted) {
        LoggerService.warn(
          `${FILE_NAME}: useBiometricLogin.resolveAvailability: unmounted before resolution — discarding result`,
        );
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
      LoggerService.info(`${FILE_NAME}: useBiometricLogin: availability effect cleanup`);
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

        LoggerService.info(
          `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: vault unlocked, re-authenticating`,
        );

        let loginResult: LoginResult;
        try {
          loginResult = await login({
            username: credentials.username,
            password: credentials.password,
          });
          LoggerService.info(
            `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: stored credentials accepted`,
          );
        } catch (loginError: unknown) {
          if (axios.isAxiosError(loginError) && loginError.response?.status === 401) {
            // The stored password itself no longer works (e.g. changed
            // server-side) — fail securely, this vault entry can't recover.
            LoggerService.warn(
              `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: stored password rejected, clearing vault`,
            );
            await BiometricCredentialStorageService.clear();
            setIsAvailable(false);
          } else {
            LoggerService.warn(
              `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: re-authentication failed, vault kept`,
            );
          }
          throw loginError;
        }

        await restoreSession(loginResult);

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
        LoggerService.info(
          `${FILE_NAME}: useBiometricLogin.loginWithBiometrics: attempt settled`,
        );
        setIsAuthenticating(false);
      }
    })();
  }, [navigation, t]);

  return { isAvailable, biometryType, isAuthenticating, biometricLoginError, loginWithBiometrics };
}
