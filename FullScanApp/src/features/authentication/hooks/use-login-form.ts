import { useCallback, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';

import { LoggerService } from '@/infrastructure/logger';
import { login } from '@/repositories/authentication-repository';
import { loadReferenceData } from '@/repositories/reference-data-repository';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import { useSessionStore } from '@/store/session';
import { useReferenceDataStore } from '@/store/reference-data';

import type { LoginErrorKey, LoginFormValues } from '../types/login-form.types';
import { useBiometricEnrollment } from './use-biometric-enrollment';

const FILE_NAME = 'use-login-form.ts';

/**
 * Localization keys, not literals: React Hook Form stores the key as the
 * error message and the screen resolves it through i18next at render time,
 * so an already-shown error switches language with the rest of the UI.
 */
export const VALIDATION_REQUIRED_MESSAGE_KEY = 'validation.required';

const DEFAULT_VALUES: LoginFormValues = {
  username: '',
  password: '',
  employeeId: '',
  rememberMe: false,
};

export interface UseLoginFormResult {
  readonly control: Control<LoginFormValues>;
  readonly errors: FieldErrors<LoginFormValues>;
  readonly isSubmitting: boolean;
  /** True once both required fields (username, password) hold non-blank values. */
  readonly canSubmit: boolean;
  /** Localization key for the current login failure, or null when there isn't one. */
  readonly loginError: LoginErrorKey | null;
  submitLogin(): void;
  /** True while the post-login "enable biometric login?" consent dialog should be shown. */
  readonly isBiometricEnrollmentPromptVisible: boolean;
  confirmBiometricEnrollment(): Promise<void>;
  skipBiometricEnrollment(): void;
}

/**
 * Maps a thrown login failure to one of the login screen's error keys.
 * Never surfaces the raw error (which may echo backend response bodies) to
 * the UI — only the mapped key.
 */
function resolveLoginErrorKey(error: unknown): LoginErrorKey {
  // Only the shape of the failure is logged — never the error body, which can echo credentials.
  LoggerService.info(`${FILE_NAME}: resolveLoginErrorKey: resolving login failure`, {
    isAxiosError: axios.isAxiosError(error),
  });
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const errorKey: LoginErrorKey =
      status === 401
        ? 'invalidCredentials'
        : status === 403
        ? 'deviceMismatch'
        : status !== undefined && status >= 500
        ? 'serverUnavailable'
        : 'network';
    LoggerService.warn(`${FILE_NAME}: resolveLoginErrorKey: mapping login failure`, {
      status,
      errorKey,
    });
    return errorKey;
  }
  LoggerService.warn(`${FILE_NAME}: resolveLoginErrorKey: mapping non-axios login failure`, {
    errorKey: 'network',
  });
  return 'network';
}

/**
 * Owns Login form state, field validation and submission. Authentication
 * itself is delegated to the authentication repository — this hook never
 * talks to the network directly.
 */
export function useLoginForm(): UseLoginFormResult {
  LoggerService.info(`${FILE_NAME}: useLoginForm: initializing login form`);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ defaultValues: DEFAULT_VALUES, mode: 'onSubmit' });

  const [loginError, setLoginError] = useState<LoginErrorKey | null>(null);

  const {
    isPromptVisible: isBiometricEnrollmentPromptVisible,
    syncAfterPasswordLogin: syncBiometricsAfterPasswordLogin,
    confirmEnrollment: confirmBiometricEnrollment,
    skipEnrollment: skipBiometricEnrollment,
  } = useBiometricEnrollment(() => {
    LoggerService.info(
      `${FILE_NAME}: useLoginForm.onBiometricEnrollmentSettled: navigating to main`,
    );
    navigation.replace(ROUTE_NAMES.MAIN);
  });

  const username = useWatch({ control, name: 'username' });
  const password = useWatch({ control, name: 'password' });
  const canSubmit = username.trim().length > 0 && password.trim().length > 0;

  // Field presence only — credential values are never logged.
  LoggerService.info(`${FILE_NAME}: useLoginForm: resolved submit eligibility`, {
    hasUsername: username.trim().length > 0,
    hasPassword: password.trim().length > 0,
    canSubmit,
    hasLoginError: loginError !== null,
    isSubmitting,
  });

  const submitLogin = useCallback(() => {
    LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: submit requested`);
    void handleSubmit(
      async (values: LoginFormValues) => {
        // Credentials are never logged — only non-identifying form metadata.
        LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: form valid`, {
          rememberMe: values.rememberMe,
          hasEmployeeId: values.employeeId.trim().length > 0,
        });

        setLoginError(null);
        try {
          LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: authenticating credentials`);
          const { fieldExecutive, masterDataUpdatedAt } = await login({
            username: values.username,
            password: values.password,
          });
          LoggerService.info(
            `${FILE_NAME}: useLoginForm.submitLogin: credentials accepted, loading reference data`,
            { fieldExecutiveId: fieldExecutive.id, masterDataUpdatedAt },
          );
          // From the device cache when the server's master-data version is
          // unchanged, otherwise from `GET /master-data`.
          const referenceData = await loadReferenceData(masterDataUpdatedAt);
          // Configuration before session, deliberately: the profile is already
          // in hand from `login()`, but establishing the session is what starts
          // location validation (see `ApplicationShell`), and that validation
          // reads `mobileAppSettings` — so the session is held back until the
          // settings are in the store. This is the `Login Success → Load
          // mobileAppSettings → Validate Location → App Ready` order.
          useReferenceDataStore.getState().setReferenceData(referenceData);
          useSessionStore.getState().setFieldExecutive(fieldExecutive);
          LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: login succeeded`);

          // Every successful password login refreshes an existing biometric
          // vault with these credentials, or offers enrollment when there is none.
          const willPromptBiometricEnrollment = await syncBiometricsAfterPasswordLogin({
            username: values.username,
            password: values.password,
          });
          LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: biometric vault synced`, {
            willPromptBiometricEnrollment,
          });
          if (willPromptBiometricEnrollment) {
            // The enrollment dialog now owns navigation once the user
            // enables or skips it — see `useBiometricEnrollment`'s `onSettled`.
            LoggerService.info(
              `${FILE_NAME}: useLoginForm.submitLogin: deferring navigation to enrollment prompt`,
            );
            return;
          }

          LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: navigating to main`);

          /*
          Navigation.replace is used here instead of navigate to prevent the user from going back to the login screen after a successful login. This ensures that the login screen is removed from the navigation stack, providing a better user experience.
          */
          navigation.replace(ROUTE_NAMES.MAIN);
        } catch (error: unknown) {
          const errorKey = resolveLoginErrorKey(error);
          LoggerService.error(`${FILE_NAME}: useLoginForm.submitLogin: login failed`, { errorKey });
          setLoginError(errorKey);
        }
      },
      (validationErrors: FieldErrors<LoginFormValues>) => {
        LoggerService.warn(`${FILE_NAME}: useLoginForm.submitLogin: submit blocked by validation`, {
          invalidFields: Object.keys(validationErrors).join(','),
        });
      },
    )();
  }, [handleSubmit, navigation, syncBiometricsAfterPasswordLogin]);

  return {
    control,
    errors,
    isSubmitting,
    canSubmit,
    loginError,
    submitLogin,
    isBiometricEnrollmentPromptVisible,
    confirmBiometricEnrollment,
    skipBiometricEnrollment,
  };
}
