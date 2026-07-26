import type { ComponentType } from 'react';

import type { WidgetDefinition, WidgetType } from './screen-configuration.types';

/**
 * Every registered widget receives exactly its own configuration metadata.
 * Theme and localization are consumed by the widget itself (Gluestack context /
 * react-i18next) rather than injected here, per fullscan-widget-development:
 * widgets stay stateless and bind to Runtime Context, not to prop drilling.
 */
export interface WidgetComponentProps {
  readonly definition: WidgetDefinition;
}

export type WidgetComponent = ComponentType<WidgetComponentProps>;

export type WidgetFactory = () => WidgetComponent;

export interface IWidgetRegistry {
  register(type: WidgetType, factory: WidgetFactory): void;
  resolve(type: WidgetType): WidgetComponent | undefined;
  isRegistered(type: WidgetType): boolean;
}
