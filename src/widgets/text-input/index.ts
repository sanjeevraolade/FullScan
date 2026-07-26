import type { IWidgetRegistry } from '@/contracts';

import { TextInputWidget } from './TextInputWidget';

export { TextInputWidget };

export function registerTextInputWidget(registry: IWidgetRegistry): void {
  registry.register('textInput', () => TextInputWidget);
  registry.register('email', () => TextInputWidget);
  registry.register('password', () => TextInputWidget);
}
