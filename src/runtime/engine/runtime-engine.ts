import type { IWidgetRegistry, ScreenDefinition } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';
import { LocalizationEngine as DefaultLocalizationEngine } from '@/localization';
import { ConfigurationEngine } from '@/runtime/configuration';
import { WidgetRegistry } from '@/runtime/registry';
import { ThemeEngine as DefaultThemeEngine } from '@/theme';

import type { RuntimeContext } from './runtime-context';
import type { IVerificationRuntimeEngine } from './runtime-engine.interface';
import type { VerificationRuntimeEngineDependencies } from './runtime-engine.types';

type RequiredDependencies = Required<VerificationRuntimeEngineDependencies>;

/**
 * Per docs/04-Runtime/01-Verification-Runtime-Engine.md §7 — the Runtime
 * Lifecycle this pass actually implements is:
 * Initialize -> Load Configuration -> Register Runtime Components (Theme,
 * Localization, Widget Registry). Workflow execution, navigation, attachment
 * and synchronization orchestration are out of scope here (see
 * src/runtime/workflow and src/runtime/validation skeletons).
 */
export class VerificationRuntimeEngine implements IVerificationRuntimeEngine {
  private readonly configurationEngine: RequiredDependencies['configurationEngine'];
  private readonly widgetRegistry: RequiredDependencies['widgetRegistry'];
  private readonly themeEngine: RequiredDependencies['themeEngine'];
  private readonly localizationEngine: RequiredDependencies['localizationEngine'];

  constructor(dependencies: VerificationRuntimeEngineDependencies = {}) {
    this.configurationEngine = dependencies.configurationEngine ?? new ConfigurationEngine();
    this.widgetRegistry = dependencies.widgetRegistry ?? new WidgetRegistry();
    this.themeEngine = dependencies.themeEngine ?? DefaultThemeEngine;
    this.localizationEngine = dependencies.localizationEngine ?? DefaultLocalizationEngine;
  }

  async initialize(): Promise<void> {
    LoggerService.info('Runtime initializing');

    await this.configurationEngine.initialize();
    this.themeEngine.initialize();
    await this.localizationEngine.initialize();
    this.widgetRegistry.initialize();

    LoggerService.info('Runtime initialized');
  }

  getContext(): RuntimeContext {
    return {
      theme: {
        mode: this.themeEngine.getMode(),
        resolvedMode: this.themeEngine.getResolvedMode(),
        tokens: this.themeEngine.getTokens(),
      },
      language: this.localizationEngine.getLanguage(),
      activeConfiguration: this.configurationEngine.getActiveConfiguration(),
    };
  }

  getWidgetRegistry(): IWidgetRegistry {
    return this.widgetRegistry;
  }

  getScreen(screenId: string): ScreenDefinition | undefined {
    return this.configurationEngine.getScreen(screenId);
  }

  dispose(): void {
    this.configurationEngine.dispose();
    this.themeEngine.dispose();
    this.localizationEngine.dispose();
    this.widgetRegistry.dispose();
  }
}
