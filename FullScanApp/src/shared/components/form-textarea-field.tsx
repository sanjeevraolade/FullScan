import React from 'react';
import type { ReactElement } from 'react';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  Textarea,
  TextareaInput,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

import { FormFieldLabel } from './form-field-label';

const FILE_NAME = 'form-textarea-field.tsx';

export interface FormTextareaFieldProps {
  readonly fieldId: string;
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly isDisabled?: boolean;
  /** Localization key of the current validation error, if any. */
  readonly errorKey?: string | undefined;
  /** Marks the label with a red "*" and announces the field as required. */
  readonly isRequired?: boolean;
}

/** Labelled multi-line remarks field — the Textarea counterpart to `FormTextField`. */
export function FormTextareaField({
  fieldId,
  label,
  value,
  onChangeText,
  placeholder,
  isDisabled = false,
  errorKey,
  isRequired = false,
}: FormTextareaFieldProps): ReactElement {
  const { t } = useTranslation();
  const accessibilityLabel = isRequired ? t('validation.requiredFieldLabel', { label }) : label;

  // Never log field content — only field identity and coarse state.
  LoggerService.info(`${FILE_NAME}: FormTextareaField: rendering`, {
    fieldId,
    hasValue: value.length > 0,
    isDisabled,
    isValid: !errorKey,
    isRequired,
  });

  const handleChangeText = (nextValue: string): void => {
    LoggerService.info(`${FILE_NAME}: FormTextareaField.handleChangeText: value changed`, { fieldId });
    onChangeText(nextValue);
  };

  return (
    <FormControl isDisabled={isDisabled} isInvalid={Boolean(errorKey)}>
      <FormFieldLabel label={label} isRequired={isRequired} />
      <Textarea size="sm" opacity={isDisabled ? 0.6 : 1}>
        <TextareaInput
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          accessibilityLabel={accessibilityLabel}
          // Gluestack's input sets its own generic aria-label, which outranks accessibilityLabel.
          aria-label={accessibilityLabel}
          testID={`${fieldId}-textarea`}
          editable={!isDisabled}
        />
      </Textarea>
      {errorKey ? (
        <FormControlError>
          <FormControlErrorText testID={`${fieldId}-error`}>{t(errorKey)}</FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );
}
