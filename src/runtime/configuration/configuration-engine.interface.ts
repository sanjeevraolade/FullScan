import type { ConfigurationPackage, ScreenDefinition } from '@/contracts';

export interface IConfigurationEngine {
  initialize(): Promise<void>;
  getActiveConfiguration(): ConfigurationPackage | undefined;
  getScreen(screenId: string): ScreenDefinition | undefined;
  dispose(): void;
}
