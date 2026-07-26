import type { IWidgetRegistry } from '@/contracts';

import { TextWidget } from './TextWidget';

export { TextWidget };

export function registerTextWidget(registry: IWidgetRegistry): void {
  registry.register('text', () => TextWidget);
}
