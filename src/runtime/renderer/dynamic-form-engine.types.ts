import type { IWidgetRegistry, ScreenAction, ScreenDefinition, SectionDefinition } from '@/contracts';

export interface ScreenRendererProps {
  readonly screen: ScreenDefinition;
  readonly registry: IWidgetRegistry;
  readonly onAction?: (action: ScreenAction) => void;
}

export interface SectionRendererProps {
  readonly section: SectionDefinition;
  readonly registry: IWidgetRegistry;
}
