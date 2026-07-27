import React from 'react';
import type { ReactElement } from 'react';
import { Input, InputField, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import type { WidgetComponentProps } from '@/widgets/base';

const FILE_NAME = 'TextInputWidget.tsx';

/**
 * Covers the Input-category `textInput` / `email` / `password` widget types
 * (docs/06-Contracts/04-Widget-Schema.md §4) — one component, registered
 * three times, since they only differ in keyboard/secure-entry behaviour.
 *
 * Controlled by the Dynamic Form Engine's per-screen form state
 * (`value`/`error`/`onChange`, see src/runtime/renderer/form-state.ts) so
 * the Validation Engine can check the current value on submit.
 */
export function TextInputWidget({ definition, value = '', error, onChange }: WidgetComponentProps): ReactElement {
  const { t } = useTranslation();

  const handleChangeText = (nextValue: string): void => {
    // Never log field content — this widget type also covers "password".
    LoggerService.info(`${FILE_NAME}: TextInputWidget.onChangeText: input changed`, {
      widgetId: definition.widgetId,
      type: definition.type,
    });
    onChange?.(nextValue);
  };

  return (
    <VStack space="xs">
      <Text size="sm">{t(definition.labelKey)}</Text>
      <Input isInvalid={Boolean(error)}>
        <InputField
          value={value}
          onChangeText={handleChangeText}
          secureTextEntry={definition.type === 'password'}
          keyboardType={definition.type === 'email' ? 'email-address' : 'default'}
          autoCapitalize="none"
        />
      </Input>
      {error ? (
        <Text size="xs" color="$error600">
          {t(error)}
        </Text>
      ) : null}
    </VStack>
  );
}
