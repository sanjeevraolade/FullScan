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

const FILE_NAME = 'runtime-engine.ts';

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
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.constructor: creating engine`, {
      usesCustomConfigurationEngine: Boolean(dependencies.configurationEngine),
      usesCustomWidgetRegistry: Boolean(dependencies.widgetRegistry),
      usesCustomThemeEngine: Boolean(dependencies.themeEngine),
      usesCustomLocalizationEngine: Boolean(dependencies.localizationEngine),
    });
    this.configurationEngine = dependencies.configurationEngine ?? new ConfigurationEngine();
    this.widgetRegistry = dependencies.widgetRegistry ?? new WidgetRegistry();
    this.themeEngine = dependencies.themeEngine ?? DefaultThemeEngine;
    this.localizationEngine = dependencies.localizationEngine ?? DefaultLocalizationEngine;
  }

  async initialize(): Promise<void> {
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.initialize: starting`);

    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.initialize: initializing configuration engine`);
    await this.configurationEngine.initialize();
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.initialize: initializing theme engine`);
    this.themeEngine.initialize();
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.initialize: initializing localization engine`);
    await this.localizationEngine.initialize();
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.initialize: initializing widget registry`);
    this.widgetRegistry.initialize();

    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.initialize: completed`);
  }

  getContext(): RuntimeContext {
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.getContext: building runtime context snapshot`);
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
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.getWidgetRegistry: returning widget registry`);
    return this.widgetRegistry;
  }

  getScreen(screenId: string): ScreenDefinition | undefined {
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.getScreen: resolving screen`, { screenId });
    return this.configurationEngine.getScreen(screenId);
  }

  dispose(): void {
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.dispose: disposing engines`);
    this.configurationEngine.dispose();
    this.themeEngine.dispose();
    this.localizationEngine.dispose();
    this.widgetRegistry.dispose();
    LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.dispose: completed`);
  }
}
