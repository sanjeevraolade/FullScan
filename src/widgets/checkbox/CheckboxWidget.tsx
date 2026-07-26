import React from 'react';
import type { ReactElement } from 'react';
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel, CheckIcon } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import type { WidgetComponentProps } from '@/widgets/base';

/**
 * Selection-category `checkbox` widget type (docs/06-Contracts/04-Widget-Schema.md §4).
 *
 * The checked state is represented as the string `'true'`/`'false'` so it
 * fits the shared string-based form state (src/runtime/renderer/form-state.ts)
 * — simpler than widening the whole widget contract to a union value type
 * for one boolean field. An unchecked, non-required checkbox never fails
 * validation (ValidationEngine only checks `required` fields).
 */
export function CheckboxWidget({ definition, value = 'false', onChange }: WidgetComponentProps): ReactElement {
  const { t } = useTranslation();
  const isChecked = value === 'true';

  return (
    <Checkbox
      value={definition.widgetId}
      isChecked={isChecked}
      onChange={(nextIsChecked: boolean) => {
        LoggerService.info('CheckboxWidget.onChange: checkbox toggled', {
          widgetId: definition.widgetId,
          isChecked: nextIsChecked,
        });
        onChange?.(nextIsChecked ? 'true' : 'false');
      }}
    >
      <CheckboxIndicator mr="$2">
        <CheckboxIcon as={CheckIcon} />
      </CheckboxIndicator>
      <CheckboxLabel>{t(definition.labelKey)}</CheckboxLabel>
    </Checkbox>
  );
}
