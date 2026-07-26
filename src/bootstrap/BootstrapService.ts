import { hideSplashScreen } from '@/infrastructure/splash';
import { VerificationRuntimeEngine } from '@/runtime/engine';
import { registerBuiltInWidgets } from '@/widgets';

import type { BootstrapContext } from './BootstrapContext';
import { BootstrapPipeline } from './BootstrapPipeline';
import type { BootstrapResult } from './BootstrapResult';
import type { BootstrapStep } from './BootstrapStep';

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
    const runtimeEngine = new VerificationRuntimeEngine();
    await runtimeEngine.initialize();
    registerBuiltInWidgets(runtimeEngine.getWidgetRegistry());
    context.runtimeEngine = runtimeEngine;
  },
};

const hideSplashStep: BootstrapStep = {
  name: 'splash',
  async execute(): Promise<void> {
    await hideSplashScreen();
  },
};

export async function runBootstrap(): Promise<BootstrapResult> {
  const pipeline = new BootstrapPipeline([initializeRuntimeStep, hideSplashStep]);
  return pipeline.run();
}
