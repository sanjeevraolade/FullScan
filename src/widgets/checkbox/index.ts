import type { IWidgetRegistry } from '@/contracts';

import { CheckboxWidget } from './CheckboxWidget';

export { CheckboxWidget };

export function registerCheckboxWidget(registry: IWidgetRegistry): void {
  registry.register('checkbox', () => CheckboxWidget);
}
