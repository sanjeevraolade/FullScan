import React from 'react';
import type { ReactElement } from 'react';
import { FormControl, FormControlLabel, FormControlLabelText, Textarea, TextareaInput } from '@gluestack-ui/themed';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'form-textarea-field.tsx';

export interface FormTextareaFieldProps {
  readonly fieldId: string;
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
}

/** Labelled multi-line remarks field — the Textarea counterpart to `FormTextField`. */
export function FormTextareaField({
  fieldId,
  label,
  value,
  onChangeText,
  placeholder,
}: FormTextareaFieldProps): ReactElement {
  const handleChangeText = (nextValue: string): void => {
    LoggerService.info(`${FILE_NAME}: FormTextareaField.handleChangeText: value changed`, { fieldId });
    onChangeText(nextValue);
  };

  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Textarea size="sm">
        <TextareaInput
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          accessibilityLabel={label}
          testID={`${fieldId}-textarea`}
        />
      </Textarea>
    </FormControl>
  );
}
