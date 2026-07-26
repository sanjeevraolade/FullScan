import type { IWidgetRegistry } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { TextInputWidget } from './TextInputWidget';

export { TextInputWidget };

export function registerTextInputWidget(registry: IWidgetRegistry): void {
  LoggerService.info('registerTextInputWidget: registering textInput/email/password widget types');
  registry.register('textInput', () => TextInputWidget);
  registry.register('email', () => TextInputWidget);
  registry.register('password', () => TextInputWidget);
}
