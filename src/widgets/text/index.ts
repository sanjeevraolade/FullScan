import type { IWidgetRegistry } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { TextWidget } from './TextWidget';

export { TextWidget };

const FILE_NAME = 'widgets/text/index.ts';

export function registerTextWidget(registry: IWidgetRegistry): void {
  LoggerService.info(`${FILE_NAME}: registerTextWidget: registering text widget type`);
  registry.register('text', () => TextWidget);
}
