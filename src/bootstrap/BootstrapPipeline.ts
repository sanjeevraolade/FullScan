import { LoggerService } from '@/infrastructure/logger';

import type { BootstrapContext } from './BootstrapContext';
import type { BootstrapResult } from './BootstrapResult';
import type { BootstrapStep } from './BootstrapStep';

/**
 * Runs steps in order, stopping at the first failure rather than leaving the
 * app half-initialized (per src/bootstrap/README.md "Handle startup
 * failures").
 */
export class BootstrapPipeline {
  constructor(private readonly steps: readonly BootstrapStep[]) {}

  async run(): Promise<BootstrapResult> {
    LoggerService.info('BootstrapPipeline.run: starting', { stepCount: this.steps.length });
    const context: BootstrapContext = {};

    for (const step of this.steps) {
      LoggerService.info('BootstrapPipeline.run: executing step', { step: step.name });
      try {
        await step.execute(context);
        LoggerService.info('BootstrapPipeline.run: step succeeded', { step: step.name });
      } catch (error) {
        LoggerService.error('Bootstrap step failed', { step: step.name, error: String(error) });
        return { success: false, error, failedStep: step.name };
      }
    }

    LoggerService.info('BootstrapPipeline.run: completed', { stepCount: this.steps.length });
    return { success: true, context };
  }
}
