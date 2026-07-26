import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { Input, InputField, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import type { WidgetComponentProps } from '@/widgets/base';

/**
 * Covers the Input-category `textInput` / `email` / `password` widget types
 * (docs/06-Contracts/04-Widget-Schema.md §4) — one component, registered
 * three times, since they only differ in keyboard/secure-entry behaviour.
 *
 * Local component state only: not yet bound to Runtime Context form state
 * or the Validation Engine (see src/runtime/renderer/README.md) — there is
 * no Workflow/Validation Engine yet to hand the value to.
 */
export function TextInputWidget({ definition }: WidgetComponentProps): ReactElement {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  return (
    <VStack space="xs">
      <Text size="sm">{t(definition.labelKey)}</Text>
      <Input>
        <InputField
          value={value}
          onChangeText={setValue}
          secureTextEntry={definition.type === 'password'}
          keyboardType={definition.type === 'email' ? 'email-address' : 'default'}
          autoCapitalize="none"
        />
      </Input>
    </VStack>
  );
}
