import { LoggerService } from '@/infrastructure/logger';
import { hideSplashScreen } from '@/infrastructure/splash';
import { LocalizationEngine } from '@/localization';
import { ThemeEngine } from '@/theme';

import type { BootstrapContext } from './BootstrapContext';
import { BootstrapPipeline } from './BootstrapPipeline';
import type { BootstrapResult } from './BootstrapResult';
import type { BootstrapStep } from './BootstrapStep';

const FILE_NAME = 'BootstrapService.ts';

/**
 * Concrete startup pipeline (src/bootstrap/README.md):
 * Logger (already live, no init needed) -> Storage (not implemented yet,
 * nothing to persist in this pass) -> Theme -> Localization -> Application
 * Ready (splash hidden). Screens are plain React components, so nothing
 * needs registering before the first screen can render.
 */
const initializeThemeStep: BootstrapStep = {
  name: 'theme',
  async execute(context: BootstrapContext): Promise<void> {
    LoggerService.info(`${FILE_NAME}: initializeThemeStep.execute: starting`);
    ThemeEngine.initialize();
    context.themeMode = ThemeEngine.getMode();
    LoggerService.info(`${FILE_NAME}: initializeThemeStep.execute: completed`, {
      themeMode: context.themeMode,
    });
  },
};

const initializeLocalizationStep: BootstrapStep = {
  name: 'localization',
  async execute(context: BootstrapContext): Promise<void> {
    LoggerService.info(`${FILE_NAME}: initializeLocalizationStep.execute: starting`);
    await LocalizationEngine.initialize();
    context.language = LocalizationEngine.getLanguage();
    LoggerService.info(`${FILE_NAME}: initializeLocalizationStep.execute: completed`, {
      language: context.language,
    });
  },
};

const hideSplashStep: BootstrapStep = {
  name: 'splash',
  async execute(): Promise<void> {
    LoggerService.info(`${FILE_NAME}: hideSplashStep.execute: starting`);
    await hideSplashScreen();
    LoggerService.info(`${FILE_NAME}: hideSplashStep.execute: completed`);
  },
};

export async function runBootstrap(): Promise<BootstrapResult> {
  LoggerService.info(`${FILE_NAME}: runBootstrap: starting`);
  const pipeline = new BootstrapPipeline([
    initializeThemeStep,
    initializeLocalizationStep,
    hideSplashStep,
  ]);
  const result = await pipeline.run();
  LoggerService.info(`${FILE_NAME}: runBootstrap: finished`, { success: result.success });
  if (!result.success) {
    LoggerService.warn(`${FILE_NAME}: runBootstrap: pipeline stopped at a failed step`, {
      failedStep: result.failedStep,
    });
  }
  return result;
}
