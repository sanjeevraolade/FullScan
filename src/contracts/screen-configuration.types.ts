/**
 * Types mirroring docs/06-Contracts/01-Configuration-Schema.md,
 * 03-Screen-Schema.md and 04-Widget-Schema.md. Only the fields consumed by
 * the current Runtime Engine slice are declared — the schema is additive,
 * so unread fields can be introduced later without breaking this contract.
 */

export type ScreenLayout =
  | 'scroll'
  | 'vertical'
  | 'horizontal'
  | 'grid'
  | 'card'
  | 'accordion'
  | 'tabs';

export type ScreenAction =
  | 'submit'
  | 'cancel'
  | 'save'
  | 'next'
  | 'previous'
  | 'capture'
  | 'refresh';

export type WidgetType =
  | 'label'
  | 'text'
  | 'badge'
  | 'divider'
  | 'icon'
  | 'textInput'
  | 'numberInput'
  | 'phone'
  | 'email'
  | 'password'
  | 'textArea'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'multiSelect'
  | 'switch'
  | 'date'
  | 'time'
  | 'dateTime'
  | 'camera'
  | 'attachment'
  | 'gps'
  | 'map'
  | 'signature'
  | 'section'
  | 'card'
  | 'grid'
  | 'accordion';

export interface WidgetDefinition {
  readonly widgetId: string;
  readonly type: WidgetType;
  readonly labelKey: string;
  readonly binding?: string;
  readonly required?: boolean;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly order?: number;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface SectionDefinition {
  readonly sectionId: string;
  readonly titleKey: string;
  readonly layout?: ScreenLayout;
  readonly order: number;
  readonly visible: boolean;
  readonly widgets: readonly WidgetDefinition[];
}

export interface ScreenDefinition {
  readonly screenId: string;
  readonly version: number;
  readonly titleKey: string;
  readonly workflowId: string;
  readonly layout: ScreenLayout;
  readonly visible: boolean;
  readonly sections: readonly SectionDefinition[];
  readonly actions?: readonly ScreenAction[];
}

export type ConfigurationEnvironment = 'DEV' | 'QA' | 'UAT' | 'PROD';

export interface ConfigurationMetadata {
  readonly configurationVersion: string;
  readonly minimumAppVersion: string;
  readonly generatedOn: string;
  readonly checksum?: string;
  readonly schemaVersion?: string;
  readonly customerId?: string;
  readonly environment?: ConfigurationEnvironment;
}

export interface ConfigurationPackage extends ConfigurationMetadata {
  readonly screens: readonly ScreenDefinition[];
}
