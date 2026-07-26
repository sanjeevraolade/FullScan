import type { IWidgetRegistry, ScreenDefinition, SectionDefinition } from '@/contracts';

export interface ScreenRendererProps {
  readonly screen: ScreenDefinition;
  readonly registry: IWidgetRegistry;
}

export interface SectionRendererProps {
  readonly section: SectionDefinition;
  readonly registry: IWidgetRegistry;
}
