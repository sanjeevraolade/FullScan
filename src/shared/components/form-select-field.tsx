import React from 'react';
import type { ReactElement } from 'react';
import {
  ChevronDownIcon,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from '@gluestack-ui/themed';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'form-select-field.tsx';

export interface FormSelectOption {
  readonly label: string;
  readonly value: string;
}

export interface FormSelectFieldProps {
  readonly fieldId: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly FormSelectOption[];
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  readonly isDisabled?: boolean;
}

/**
 * Labelled dropdown built from Gluestack's Select — the option-list
 * counterpart to `FormTextField`, reused across every status/reason/tag
 * picker in the Case Details verification form instead of repeating the
 * Select boilerplate per screen.
 */
export function FormSelectField({
  fieldId,
  label,
  value,
  options,
  onValueChange,
  placeholder,
  isDisabled = false,
}: FormSelectFieldProps): ReactElement {
  // Never log the selected value itself — only field identity and coarse state.
  LoggerService.info(`${FILE_NAME}: FormSelectField: rendering`, {
    fieldId,
    hasValue: value.length > 0,
    optionCount: options.length,
    isDisabled,
  });

  if (options.length === 0) {
    LoggerService.warn(`${FILE_NAME}: FormSelectField: rendering with no options`, { fieldId });
  }

  const handleValueChange = (nextValue: string): void => {
    LoggerService.info(`${FILE_NAME}: FormSelectField.handleValueChange: value changed`, { fieldId });
    onValueChange(nextValue);
  };

  return (
    <FormControl isDisabled={isDisabled}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Select selectedValue={value} onValueChange={handleValueChange} isDisabled={isDisabled}>
        <SelectTrigger variant="outline" size="sm" testID={`${fieldId}-select`} opacity={isDisabled ? 0.6 : 1}>
          <SelectInput placeholder={placeholder} accessibilityLabel={label} flex={1} />
          <SelectIcon as={ChevronDownIcon} mr="$3" />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            {options.map((option) => {
              LoggerService.info(`${FILE_NAME}: FormSelectField: rendering option`, {
                fieldId,
                optionValue: option.value,
              });

              return <SelectItem key={option.value} label={option.label} value={option.value} />;
            })}
          </SelectContent>
        </SelectPortal>
      </Select>
    </FormControl>
  );
}
