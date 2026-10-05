import React from 'react';
import type { ComponentProps, ReactElement } from 'react';
import { FormControlLabel, FormControlLabelText, Text } from '@gluestack-ui/themed';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'form-field-label.tsx';

export interface RequiredIndicatorProps {
  /** Match the text it follows; defaults to a field label's size. */
  readonly size?: ComponentProps<typeof Text>['size'];
}

/**
 * The red "*" after the label of a mandatory field — the same red as the
 * field's validation error, so "required" and "missing" read as one thing.
 * Rendered here rather than through `FormControl isRequired`, whose built-in
 * asterisk is only colourable through a theme override that doesn't reliably
 * reach the device. Hidden from screen readers: each field says "required" in
 * its own accessibility label instead of reading out "star".
 */
export function RequiredIndicator({ size = 'md' }: RequiredIndicatorProps): ReactElement {
  LoggerService.info(`${FILE_NAME}: RequiredIndicator: rendering`, { size });
  return (
    <Text
      size={size}
      color="$error700"
      sx={{ _dark: { color: '$error400' } }}
      accessibilityElementsHidden
      importantForAccessibility="no"
      testID="required-indicator"
    >
      *
    </Text>
  );
}

export interface FormFieldLabelProps {
  readonly label: string;
  readonly isRequired?: boolean;
}

/** A form field's label, followed by a red "*" when the field is mandatory. */
export function FormFieldLabel({ label, isRequired = false }: FormFieldLabelProps): ReactElement {
  LoggerService.info(`${FILE_NAME}: FormFieldLabel: rendering`, { isRequired });
  return (
    <FormControlLabel>
      <FormControlLabelText>{label}</FormControlLabelText>
      {isRequired ? <RequiredIndicator /> : null}
    </FormControlLabel>
  );
}
