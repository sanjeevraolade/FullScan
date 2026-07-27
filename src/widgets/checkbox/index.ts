import type { IWidgetRegistry } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { CheckboxWidget } from './CheckboxWidget';

export { CheckboxWidget };

const FILE_NAME = 'widgets/checkbox/index.ts';

export function registerCheckboxWidget(registry: IWidgetRegistry): void {
  LoggerService.info(`${FILE_NAME}: registerCheckboxWidget: registering checkbox widget type`);
  registry.register('checkbox', () => CheckboxWidget);
}
