import type { ComponentType } from 'react';

import type { WidgetDefinition, WidgetType } from './screen-configuration.types';

/**
 * Every registered widget receives its own configuration metadata. Theme and
 * localization are consumed by the widget itself (Gluestack context /
 * react-i18next) rather than injected here, per fullscan-widget-development:
 * widgets stay stateless and bind to Runtime Context, not to prop drilling.
 *
 * `value`/`error`/`onChange` are the one exception: input-category widgets
 * are controlled by the Dynamic Form Engine's per-screen form state (see
 * src/runtime/renderer/form-state.ts) so a submit action can validate every
 * field's current value. Display widgets (e.g. `text`) simply ignore them.
 */
export interface WidgetComponentProps {
  readonly definition: WidgetDefinition;
  readonly value?: string | undefined;
  readonly error?: string | undefined;
  readonly onChange?: ((value: string) => void) | undefined;
}

export type WidgetComponent = ComponentType<WidgetComponentProps>;

export type WidgetFactory = () => WidgetComponent;

export interface IWidgetRegistry {
  register(type: WidgetType, factory: WidgetFactory): void;
  resolve(type: WidgetType): WidgetComponent | undefined;
  isRegistered(type: WidgetType): boolean;
}
