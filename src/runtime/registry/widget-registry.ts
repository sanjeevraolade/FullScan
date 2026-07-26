import type { WidgetComponent, WidgetFactory, WidgetType } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { WIDGET_REGISTRY_UNKNOWN_TYPE_MESSAGE } from './widget-registry.constants';
import type { IWidgetRegistryEngine } from './widget-registry.interface';

/**
 * Widget Registry per docs/04-Runtime/04-Widget-Registry.md — registration is
 * a plain Map lookup (Register(widgetType, widgetFactory) -> resolve), kept
 * free of business logic. Instantiated (not a singleton) so the Verification
 * Runtime Engine, and tests, each get an isolated registry.
 */
export class WidgetRegistry implements IWidgetRegistryEngine {
  private readonly factories = new Map<WidgetType, WidgetFactory>();

  initialize(): void {
    this.factories.clear();
  }

  register(type: WidgetType, factory: WidgetFactory): void {
    this.factories.set(type, factory);
  }

  resolve(type: WidgetType): WidgetComponent | undefined {
    const factory = this.factories.get(type);
    if (!factory) {
      LoggerService.warn(WIDGET_REGISTRY_UNKNOWN_TYPE_MESSAGE, { type });
      return undefined;
    }
    return factory();
  }

  isRegistered(type: WidgetType): boolean {
    return this.factories.has(type);
  }

  dispose(): void {
    this.factories.clear();
  }
}
