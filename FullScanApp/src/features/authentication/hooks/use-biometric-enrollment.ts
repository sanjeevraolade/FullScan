import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { BiometricsService } from '@/infrastructure/biometrics';
import { BiometricCredentialStorageService } from '@/infrastructure/storage';
import type { BiometricCredentials } from '@/infrastructure/storage';

const FILE_NAME = 'use-biometric-enrollment.ts';

export type PendingBiometricEnrollment = BiometricCredentials;

export interface UseBiometricEnrollmentResult {
  /** True while the "enable biometric login?" consent dialog should be shown. */
  readonly isPromptVisible: boolean;
  /**
   * Runs after every successful password login: refreshes an existing vault
   * with the credentials that just worked, or offers enrollment when there is
   * none. Returns true when the consent dialog was shown.
   */
  syncAfterPasswordLogin(credentials: PendingBiometricEnrollment): Promise<boolean>;
  confirmEnrollment(): Promise<void>;
  skipEnrollment(): void;
}

/**
 * Owns the biometric vault after a password login: the "enable biometric
 * login?" consent flow, and keeping an existing vault in step with the last
 * credentials that worked — otherwise a vault enrolled by another account on
 * this device (or before a password change) keeps replaying stale credentials,
 * which the server rejects. Never persists the plaintext password anywhere
 * outside the vault and its own state, and clears that state once the
 * enrollment settles (enabled, declined, or failed).
 */
export function useBiometricEnrollment(onSettled: () => void): UseBiometricEnrollmentResult {
  LoggerService.info(`${FILE_NAME}: useBiometricEnrollment: initializing enrollment flow`);

  const { t } = useTranslation();
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<PendingBiometricEnrollment | null>(
    null,
  );

  /**
   * Overwrites the vault with the credentials that just logged in. A failed
   * or cancelled write (Android may prompt for it) clears the vault instead —
   * a vault that can't be refreshed may hold another account's credentials,
   * and the next password login offers enrollment again.
   */
  const refreshEnrollment = useCallback(
    async (credentials: PendingBiometricEnrollment): Promise<void> => {
      LoggerService.info(
        `${FILE_NAME}: useBiometricEnrollment.refreshEnrollment: refreshing biometric vault`,
      );
      try {
        await BiometricCredentialStorageService.save(
          credentials,
          t('login.biometric.refresh.promptTitle'),
        );
        LoggerService.info(
          `${FILE_NAME}: useBiometricEnrollment.refreshEnrollment: biometric vault refreshed`,
        );
      } catch (error: unknown) {
        LoggerService.warn(
          `${FILE_NAME}: useBiometricEnrollment.refreshEnrollment: refresh failed, clearing vault`,
        );
        await BiometricCredentialStorageService.clear();
      }
    },
    [t],
  );

  const syncAfterPasswordLogin = useCallback(
    async (credentials: PendingBiometricEnrollment): Promise<boolean> => {
      LoggerService.info(
        `${FILE_NAME}: useBiometricEnrollment.syncAfterPasswordLogin: checking device and vault`,
      );
      const [deviceSupportsBiometrics, hasExistingEnrollment] = await Promise.all([
        BiometricsService.isSupported(),
        BiometricCredentialStorageService.exists(),
      ]);
      LoggerService.info(
        `${FILE_NAME}: useBiometricEnrollment.syncAfterPasswordLogin: resolved device and vault`,
        { deviceSupportsBiometrics, hasExistingEnrollment },
      );

      if (hasExistingEnrollment) {
        if (deviceSupportsBiometrics) {
          await refreshEnrollment(credentials);
        } else {
          // Biometrics were removed from the device — the vault can never be
          // unlocked again, so drop it rather than leave the credentials behind.
          LoggerService.warn(
            `${FILE_NAME}: useBiometricEnrollment.syncAfterPasswordLogin: biometrics unavailable, clearing vault`,
          );
          await BiometricCredentialStorageService.clear();
        }
        return false;
      }

      if (!deviceSupportsBiometrics) {
        LoggerService.info(
          `${FILE_NAME}: useBiometricEnrollment.syncAfterPasswordLogin: prompt skipped — no biometrics`,
        );
        return false;
      }

      LoggerService.info(
        `${FILE_NAME}: useBiometricEnrollment.syncAfterPasswordLogin: showing consent prompt`,
      );
      setPendingCredentials(credentials);
      setIsPromptVisible(true);
      return true;
    },
    [refreshEnrollment],
  );

  const confirmEnrollment = useCallback(async (): Promise<void> => {
    if (!pendingCredentials) {
      LoggerService.warn(
        `${FILE_NAME}: useBiometricEnrollment.confirmEnrollment: no pending credentials`,
      );
      setIsPromptVisible(false);
      onSettled();
      return;
    }
    LoggerService.info(
      `${FILE_NAME}: useBiometricEnrollment.confirmEnrollment: enrollment accepted`,
    );
    try {
      await BiometricCredentialStorageService.save(pendingCredentials);
      // The save itself may not prompt on every platform — this read is what
      // guarantees the OS biometric consent UI actually runs before the
      // vault is considered enabled.
      const verified = await BiometricCredentialStorageService.retrieve(
        t('login.biometric.enroll.verifyPromptTitle'),
      );
      if (!verified) {
        LoggerService.warn(
          `${FILE_NAME}: useBiometricEnrollment.confirmEnrollment: verification failed, rolling back`,
        );
        await BiometricCredentialStorageService.clear();
      } else {
        LoggerService.info(
          `${FILE_NAME}: useBiometricEnrollment.confirmEnrollment: biometric login enabled`,
        );
      }
    } catch (error: unknown) {
      LoggerService.error(
        `${FILE_NAME}: useBiometricEnrollment.confirmEnrollment: enrollment failed`,
      );
      await BiometricCredentialStorageService.clear();
    } finally {
      LoggerService.info(
        `${FILE_NAME}: useBiometricEnrollment.confirmEnrollment: enrollment settled, clearing pending credentials`,
      );
      setPendingCredentials(null);
      setIsPromptVisible(false);
      onSettled();
    }
  }, [pendingCredentials, onSettled, t]);

  const skipEnrollment = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: useBiometricEnrollment.skipEnrollment: enrollment declined`);
    setPendingCredentials(null);
    setIsPromptVisible(false);
    onSettled();
  }, [onSettled]);

  return { isPromptVisible, syncAfterPasswordLogin, confirmEnrollment, skipEnrollment };
}
