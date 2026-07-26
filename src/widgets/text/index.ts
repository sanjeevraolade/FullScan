import type { IWidgetRegistry } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { TextWidget } from './TextWidget';

export { TextWidget };

export function registerTextWidget(registry: IWidgetRegistry): void {
  LoggerService.info('registerTextWidget: registering text widget type');
  registry.register('text', () => TextWidget);
}
