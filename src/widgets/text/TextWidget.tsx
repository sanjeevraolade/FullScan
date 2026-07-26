import React from 'react';
import type { ReactElement } from 'react';
import { Text } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import type { WidgetComponentProps } from '@/widgets/base';

/**
 * Display widget for the "text" widget type (docs/06-Contracts/04-Widget-Schema.md §4, Display
 * category). Stateless: it only resolves `definition.labelKey` through the Localization Engine
 * (react-i18next's global instance) and renders it via Gluestack's `Text`, which reads active
 * theme tokens from `GluestackUIProvider` context automatically.
 */
export function TextWidget({ definition }: WidgetComponentProps): ReactElement {
  const { t } = useTranslation();

  return <Text>{t(definition.labelKey)}</Text>;
}
