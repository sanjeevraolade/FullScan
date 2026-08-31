import React, { useImperativeHandle, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  EyeIcon,
  EyeOffIcon,
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
  Input,
  InputField,
  InputIcon,
  InputSlot,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';
import type { ReturnKeyTypeOptions } from 'react-native';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'form-text-field.tsx';

export type FormTextFieldKeyboard = 'default' | 'email-address' | 'number-pad' | 'phone-pad';

/**
 * Minimal imperative handle a screen can call — deliberately narrower than
 * `InputField`'s own ref type, whose `@gluestack-ui/themed` typings don't
 * expose the underlying native `TextInput` methods (`focus`, `blur`, ...)
 * even though the rendered node is a real `TextInput` at runtime.
 */
export interface FormTextFieldHandle {
  focus(): void;
}

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
  readonly isDisabled?: boolean;
  readonly keyboardType?: FormTextFieldKeyboard;
  readonly returnKeyType?: ReturnKeyTypeOptions | undefined;
  readonly onSubmitEditing?: (() => void) | undefined;
}

/**
 * Labelled, validated text input built from Gluestack's FormControl — the
 * one place that decides how a field's label, error and secure-entry
 * behaviour look, so every screen's fields stay consistent. Presentation
 * only: business/session state lives elsewhere, this component only tracks
 * its own transient show/hide-password UI state.
 *
 * Exposes a `FormTextFieldHandle` (currently just `focus()`) so a screen can
 * move focus between fields (e.g. username's `onSubmitEditing` focusing
 * password) without depending on the underlying input library's ref type.
 */
export const FormTextField = React.forwardRef<FormTextFieldHandle, FormTextFieldProps>(
  function FormTextField(
    {
      fieldId,
      labelKey,
      value,
      onChangeText,
      onBlur,
      errorKey,
      isRequired = false,
      isSecure = false,
      isDisabled = false,
      keyboardType = 'default',
      returnKeyType,
      onSubmitEditing,
    },
    ref,
  ): ReactElement {
    const { t } = useTranslation();
    const label = t(labelKey);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const inputRef = useRef<React.ElementRef<typeof InputField>>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          // `InputField`'s declared ref type omits TextInput's imperative
          // methods (a gap in @gluestack-ui/themed's types, not a real
          // runtime difference) — see FormTextFieldHandle above.
          const focusableInput = inputRef.current as unknown as { focus?: () => void } | null;
          focusableInput?.focus?.();
        },
      }),
      [],
    );

    const handleChangeText = (nextValue: string): void => {
      // Never log field content — this component also renders password fields.
      LoggerService.info(`${FILE_NAME}: FormTextField.handleChangeText: value changed`, { fieldId });
      onChangeText(nextValue);
    };

    const togglePasswordVisibility = (): void => {
      LoggerService.info(`${FILE_NAME}: FormTextField.togglePasswordVisibility: toggled`, {
        fieldId,
        isPasswordVisible: !isPasswordVisible,
      });
      setIsPasswordVisible((previousIsVisible) => !previousIsVisible);
    };

    const visibilityToggleLabel = t(
      isPasswordVisible ? 'login.fields.hidePassword' : 'login.fields.showPassword',
    );

    return (
      <FormControl isInvalid={Boolean(errorKey)} isRequired={isRequired} isDisabled={isDisabled}>
        <FormControlLabel>
          <FormControlLabelText>{label}</FormControlLabelText>
        </FormControlLabel>
        <Input opacity={isDisabled ? 0.6 : 1}>
          <InputField
            ref={inputRef}
            value={value}
            onChangeText={handleChangeText}
            onBlur={onBlur}
            secureTextEntry={isSecure && !isPasswordVisible}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            accessibilityLabel={label}
            testID={`${fieldId}-input`}
            editable={!isDisabled}
          />
          {isSecure ? (
            <InputSlot
              pr="$3"
              onPress={togglePasswordVisibility}
              accessibilityRole="button"
              accessibilityLabel={visibilityToggleLabel}
              // InputSlot defaults to `accessibilityElementsHidden={true}`
              // (it's meant for purely decorative accessories) — this one is
              // an interactive control, so it must stay in the a11y tree.
              accessibilityElementsHidden={false}
              importantForAccessibility="yes"
              testID={`${fieldId}-toggle-visibility`}
            >
              <InputIcon as={isPasswordVisible ? EyeOffIcon : EyeIcon} />
            </InputSlot>
          ) : null}
        </Input>
        {errorKey ? (
          <FormControlError>
            <FormControlErrorText testID={`${fieldId}-error`}>{t(errorKey)}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>
    );
  },
);
