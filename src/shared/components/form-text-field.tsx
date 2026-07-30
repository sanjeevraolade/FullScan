import React from 'react';
import type { ReactElement } from 'react';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
  Input,
  InputField,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'form-text-field.tsx';

export type FormTextFieldKeyboard = 'default' | 'email-address' | 'number-pad' | 'phone-pad';

export interface FormTextFieldProps {
  readonly fieldId: string;
  readonly labelKey: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly onBlur?: (() => void) | undefined;
  /** Localization key of the current validation error, if any. */
  readonly errorKey?: string | undefined;
  readonly isRequired?: boolean;
  readonly isSecure?: boolean;
  readonly keyboardType?: FormTextFieldKeyboard;
}

/**
 * Labelled, validated text input built from Gluestack's FormControl — the
 * one place that decides how a field's label, error and secure-entry
 * behaviour look, so every screen's fields stay consistent. Presentation
 * only: it holds no state and knows nothing about which form it belongs to.
 */
export function FormTextField({
  fieldId,
  labelKey,
  value,
  onChangeText,
  onBlur,
  errorKey,
  isRequired = false,
  isSecure = false,
  keyboardType = 'default',
}: FormTextFieldProps): ReactElement {
  const { t } = useTranslation();
  const label = t(labelKey);

  const handleChangeText = (nextValue: string): void => {
    // Never log field content — this component also renders password fields.
    LoggerService.info(`${FILE_NAME}: FormTextField.handleChangeText: value changed`, { fieldId });
    onChangeText(nextValue);
  };

  return (
    <FormControl isInvalid={Boolean(errorKey)} isRequired={isRequired}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Input>
        <InputField
          value={value}
          onChangeText={handleChangeText}
          onBlur={onBlur}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          testID={`${fieldId}-input`}
        />
      </Input>
      {errorKey ? (
        <FormControlError>
          <FormControlErrorText testID={`${fieldId}-error`}>{t(errorKey)}</FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );
}
