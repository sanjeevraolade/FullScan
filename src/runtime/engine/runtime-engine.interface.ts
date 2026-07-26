import type { IWidgetRegistry, ScreenDefinition } from '@/contracts';

import type { RuntimeContext } from './runtime-context';

export interface IVerificationRuntimeEngine {
  initialize(): Promise<void>;
  getContext(): RuntimeContext;
  getWidgetRegistry(): IWidgetRegistry;
  getScreen(screenId: string): ScreenDefinition | undefined;
  dispose(): void;
}
