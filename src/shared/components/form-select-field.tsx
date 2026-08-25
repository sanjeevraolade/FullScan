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
}: FormSelectFieldProps): ReactElement {
  const handleValueChange = (nextValue: string): void => {
    LoggerService.info(`${FILE_NAME}: FormSelectField.handleValueChange: value changed`, { fieldId });
    onValueChange(nextValue);
  };

  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Select selectedValue={value} onValueChange={handleValueChange}>
        <SelectTrigger variant="outline" size="sm" testID={`${fieldId}-select`}>
          <SelectInput placeholder={placeholder} accessibilityLabel={label} flex={1} />
          <SelectIcon as={ChevronDownIcon} mr="$3" />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            {options.map((option) => (
              <SelectItem key={option.value} label={option.label} value={option.value} />
            ))}
          </SelectContent>
        </SelectPortal>
      </Select>
    </FormControl>
  );
}
