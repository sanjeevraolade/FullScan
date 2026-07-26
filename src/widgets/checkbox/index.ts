import type { IWidgetRegistry } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { CheckboxWidget } from './CheckboxWidget';

export { CheckboxWidget };

export function registerCheckboxWidget(registry: IWidgetRegistry): void {
  LoggerService.info('registerCheckboxWidget: registering checkbox widget type');
  registry.register('checkbox', () => CheckboxWidget);
}
