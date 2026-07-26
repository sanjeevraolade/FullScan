import type { IWidgetRegistry } from '@/contracts';

import { registerTextWidget } from './text';

/**
 * The one place that knows about both the Widget Registry and concrete
 * widgets — keeps the registry itself free of widget imports (Open/Closed).
 * Called from Bootstrap once the app shell exists; used directly by the
 * runtime pipeline tests until then.
 */
export function registerBuiltInWidgets(registry: IWidgetRegistry): void {
  registerTextWidget(registry);
}
