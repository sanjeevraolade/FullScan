import { hideSplashScreen } from '@/infrastructure/splash';
import { LoggerService } from '@/infrastructure/logger';
import { VerificationRuntimeEngine } from '@/runtime/engine';
import { registerBuiltInWidgets } from '@/widgets';

import type { BootstrapContext } from './BootstrapContext';
import { BootstrapPipeline } from './BootstrapPipeline';
import type { BootstrapResult } from './BootstrapResult';
import type { BootstrapStep } from './BootstrapStep';

const FILE_NAME = 'BootstrapService.ts';

/**
 * Concrete startup pipeline (src/bootstrap/README.md):
 * Logger (already live, no init needed) -> Storage (not implemented yet,
 * nothing to persist in this pass) -> Configuration -> Theme -> Localization
 * -> Widget Registry (all four folded into VerificationRuntimeEngine.initialize())
 * -> Application Ready (splash hidden).
 */
const initializeRuntimeStep: BootstrapStep = {
  name: 'runtime',
  async execute(context: BootstrapContext): Promise<void> {
    LoggerService.info(`${FILE_NAME}: initializeRuntimeStep.execute: starting`);
    const runtimeEngine = new VerificationRuntimeEngine();
    await runtimeEngine.initialize();
    registerBuiltInWidgets(runtimeEngine.getWidgetRegistry());
    context.runtimeEngine = runtimeEngine;
    LoggerService.info(`${FILE_NAME}: initializeRuntimeStep.execute: completed`);
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
  const pipeline = new BootstrapPipeline([initializeRuntimeStep, hideSplashStep]);
  const result = await pipeline.run();
  LoggerService.info(`${FILE_NAME}: runBootstrap: finished`, { success: result.success });
  return result;
}
