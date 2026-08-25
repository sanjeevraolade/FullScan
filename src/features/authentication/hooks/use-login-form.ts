import { useCallback, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { LoggerService } from '@/infrastructure/logger';
import { login } from '@/repositories/authentication-repository';
import { fetchCurrentFieldExecutive } from '@/repositories/field-executive-repository';
import { fetchReferenceData } from '@/repositories/reference-data-repository';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import { useSessionStore } from '@/store/session';
import { useReferenceDataStore } from '@/store/reference-data';

import type { LoginErrorKey, LoginFormValues } from '../types/login-form.types';

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
}

/**
 * Maps an unknown thrown value to one of the login screen's error keys. The
 * placeholder repository never actually throws, so this path isn't
 * exercised today — it exists so the real repository can replace the stub
 * without any change here.
 */
function resolveLoginErrorKey(error: unknown): LoginErrorKey {
  const reason = error instanceof Error ? error.message : 'unknown error';
  LoggerService.warn(`${FILE_NAME}: resolveLoginErrorKey: mapping login failure`, { reason });
  return 'network';
}

/**
 * Owns Login form state, field validation and submission. Authentication
 * itself is delegated to the (currently stubbed) authentication repository —
 * this hook never talks to the network directly.
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

  const username = useWatch({ control, name: 'username' });
  const password = useWatch({ control, name: 'password' });
  const canSubmit = username.trim().length > 0 && password.trim().length > 0;

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
          await login({ username: values.username, password: values.password });
          const [fieldExecutive, referenceData] = await Promise.all([
            fetchCurrentFieldExecutive(),
            fetchReferenceData(),
          ]);
          useSessionStore.getState().setFieldExecutive(fieldExecutive);
          useReferenceDataStore.getState().setReferenceData(referenceData);
          LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: login succeeded`);
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
  }, [handleSubmit, navigation]);

  return { control, errors, isSubmitting, canSubmit, loginError, submitLogin };
}
