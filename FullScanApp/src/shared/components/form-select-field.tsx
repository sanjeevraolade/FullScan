import React, { useState } from 'react';
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

function findOptionLabel(options: readonly FormSelectOption[], value: string): string | undefined {
  LoggerService.info(`${FILE_NAME}: findOptionLabel: resolving option label`, { hasValue: value.length > 0 });
  return options.find((option) => option.value === value)?.label;
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

  const selectedOptionLabel = findOptionLabel(options, value);

  if (value.length > 0 && selectedOptionLabel === undefined && options.length > 0) {
    LoggerService.warn(`${FILE_NAME}: FormSelectField: selected value matches no option`, { fieldId });
  }

  // Gluestack's SelectInput shows its own internal label, which it only learns
  // from `initialLabel` at mount or from an item press — for a value supplied
  // by the parent it falls back to printing the raw code (e.g. "house_photo_1").
  // Track the label Select is currently showing and remount it (via `key`)
  // whenever that drifts from the label for `value`: options loaded late, the
  // value changed from outside, or the language switched. A normal item press
  // already updated the internal label, so it doesn't remount mid-close.
  const [displayedLabel, setDisplayedLabel] = useState({ label: selectedOptionLabel, revision: 0 });

  if (displayedLabel.label !== selectedOptionLabel) {
    LoggerService.info(`${FILE_NAME}: FormSelectField: re-syncing displayed label`, { fieldId });
    setDisplayedLabel({ label: selectedOptionLabel, revision: displayedLabel.revision + 1 });
  }

  const handleValueChange = (nextValue: string): void => {
    LoggerService.info(`${FILE_NAME}: FormSelectField.handleValueChange: value changed`, { fieldId });
    const nextLabel = findOptionLabel(options, nextValue);
    setDisplayedLabel((previous) => ({ label: nextLabel, revision: previous.revision }));
    onValueChange(nextValue);
  };

  return (
    <FormControl isDisabled={isDisabled}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Select
        key={displayedLabel.revision}
        selectedValue={value}
        initialLabel={selectedOptionLabel ?? ''}
        onValueChange={handleValueChange}
        isDisabled={isDisabled}
      >
        <SelectTrigger variant="outline" size="sm" testID={`${fieldId}-select`} opacity={isDisabled ? 0.6 : 1}>
          <SelectInput
            placeholder={placeholder}
            accessibilityLabel={label}
            flex={1}
            testID={`${fieldId}-select-input`}
          />
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
