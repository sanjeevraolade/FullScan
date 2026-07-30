import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';

import { LoggerService } from '@/infrastructure/logger';

import type { LoginFormValues } from '../types/login-form.types';

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
  submitLogin(): void;
}

/**
 * Owns Login form state and field validation. Authentication itself
 * (credential check, token storage, session) is not implemented yet — this
 * hook only validates and reports what the user entered.
 */
export function useLoginForm(): UseLoginFormResult {
  LoggerService.info(`${FILE_NAME}: useLoginForm: initializing login form`);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ defaultValues: DEFAULT_VALUES, mode: 'onSubmit' });

  const submitLogin = useCallback(() => {
    LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: submit requested`);
    void handleSubmit(
      (values: LoginFormValues) => {
        // Credentials are never logged — only non-identifying form metadata.
        LoggerService.info(`${FILE_NAME}: useLoginForm.submitLogin: form valid`, {
          rememberMe: values.rememberMe,
          hasEmployeeId: values.employeeId.trim().length > 0,
        });
      },
      (validationErrors: FieldErrors<LoginFormValues>) => {
        LoggerService.warn(`${FILE_NAME}: useLoginForm.submitLogin: submit blocked by validation`, {
          invalidFields: Object.keys(validationErrors).join(','),
        });
      },
    )();
  }, [handleSubmit]);

  return { control, errors, isSubmitting, submitLogin };
}
