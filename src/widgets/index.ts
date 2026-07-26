import type { IWidgetRegistry } from '@/contracts';

import { registerCheckboxWidget } from './checkbox';
import { registerTextWidget } from './text';
import { registerTextInputWidget } from './text-input';

/**
 * The one place that knows about both the Widget Registry and concrete
 * widgets — keeps the registry itself free of widget imports (Open/Closed).
 * Called from src/bootstrap/BootstrapService.ts on startup; also used
 * directly by the runtime pipeline tests.
 */
export function registerBuiltInWidgets(registry: IWidgetRegistry): void {
  registerTextWidget(registry);
  registerTextInputWidget(registry);
  registerCheckboxWidget(registry);
}
