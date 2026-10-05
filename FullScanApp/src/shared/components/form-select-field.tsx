import React, { useState } from 'react';
import type { ReactElement } from 'react';
import {
  ChevronDownIcon,
  FormControl,
  FormControlError,
  FormControlErrorText,
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
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

import { FormFieldLabel } from './form-field-label';

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
  /** Localization key of the current validation error, if any. */
  readonly errorKey?: string | undefined;
  /** Marks the label with a red "*" and announces the field as required. */
  readonly isRequired?: boolean;
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
  errorKey,
  isRequired = false,
}: FormSelectFieldProps): ReactElement {
  const { t } = useTranslation();
  const accessibilityLabel = isRequired ? t('validation.requiredFieldLabel', { label }) : label;

  // Never log the selected value itself — only field identity and coarse state.
  LoggerService.info(`${FILE_NAME}: FormSelectField: rendering`, {
    fieldId,
    hasValue: value.length > 0,
    optionCount: options.length,
    isDisabled,
    isValid: !errorKey,
    isRequired,
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
    <FormControl isDisabled={isDisabled} isInvalid={Boolean(errorKey)}>
      <FormFieldLabel label={label} isRequired={isRequired} />
      <Select
        key={displayedLabel.revision}
        selectedValue={value}
        initialLabel={selectedOptionLabel ?? ''}
        onValueChange={handleValueChange}
        isDisabled={isDisabled}
      >
        {/*
          The trigger is the element screen readers focus — Gluestack hides the
          SelectInput inside it from accessibility — so the label lives here.
        */}
        <SelectTrigger
          variant="outline"
          size="sm"
          testID={`${fieldId}-select`}
          opacity={isDisabled ? 0.6 : 1}
          accessibilityLabel={accessibilityLabel}
        >
          <SelectInput placeholder={placeholder} flex={1} testID={`${fieldId}-select-input`} />
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
      {errorKey ? (
        <FormControlError>
          <FormControlErrorText testID={`${fieldId}-error`}>{t(errorKey)}</FormControlErrorText>
        </FormControlError>
      ) : null}
    </FormControl>
  );
}
