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
  /** Checks device support + prior enrollment; returns true when the consent dialog was shown. */
  evaluateEligibility(credentials: PendingBiometricEnrollment): Promise<boolean>;
  confirmEnrollment(): Promise<void>;
  skipEnrollment(): void;
}

/**
 * Owns the post-login "enable biometric login?" consent flow. Only asked to
 * evaluate eligibility right after a successful password login — never
 * persists the plaintext password anywhere outside its own state, and clears
 * it once the enrollment settles (enabled, declined, or failed).
 */
export function useBiometricEnrollment(onSettled: () => void): UseBiometricEnrollmentResult {
  LoggerService.info(`${FILE_NAME}: useBiometricEnrollment: initializing enrollment flow`);

  const { t } = useTranslation();
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<PendingBiometricEnrollment | null>(
    null,
  );

  const evaluateEligibility = useCallback(
    async (credentials: PendingBiometricEnrollment): Promise<boolean> => {
      LoggerService.info(
        `${FILE_NAME}: useBiometricEnrollment.evaluateEligibility: checking eligibility`,
      );
      const [deviceSupportsBiometrics, hasExistingEnrollment] = await Promise.all([
        BiometricsService.isSupported(),
        BiometricCredentialStorageService.exists(),
      ]);
      const shouldPrompt = deviceSupportsBiometrics && !hasExistingEnrollment;
      LoggerService.info(
        `${FILE_NAME}: useBiometricEnrollment.evaluateEligibility: resolved eligibility`,
        {
          shouldPrompt,
          deviceSupportsBiometrics,
          hasExistingEnrollment,
        },
      );
      if (shouldPrompt) {
        LoggerService.info(
          `${FILE_NAME}: useBiometricEnrollment.evaluateEligibility: showing consent prompt`,
        );
        setPendingCredentials(credentials);
        setIsPromptVisible(true);
      } else {
        LoggerService.info(
          `${FILE_NAME}: useBiometricEnrollment.evaluateEligibility: prompt skipped — not eligible`,
          { deviceSupportsBiometrics, hasExistingEnrollment },
        );
      }
      return shouldPrompt;
    },
    [],
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

  return { isPromptVisible, evaluateEligibility, confirmEnrollment, skipEnrollment };
}
