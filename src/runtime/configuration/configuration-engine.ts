import type { ConfigurationPackage, ScreenDefinition } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { CONFIGURATION_ENGINE_INVALID_PACKAGE_MESSAGE } from './configuration-engine.constants';
import type { IConfigurationEngine } from './configuration-engine.interface';
import sampleConfiguration from './sample-configuration.json';

function isValidConfigurationPackage(candidate: ConfigurationPackage): boolean {
  if (!candidate.configurationVersion || !candidate.minimumAppVersion || !candidate.generatedOn) {
    return false;
  }
  const screenIds = candidate.screens.map((screen) => screen.screenId);
  return new Set(screenIds).size === screenIds.length;
}

/**
 * Per docs/04-Runtime/06-Configuration-Engine.md — this pass loads a bundled
 * local package (no networking, per the "Hello Runtime" sprint scope) but
 * still runs the same validate-before-activate step real remote packages
 * would go through. An invalid package is never activated; there is no
 * previous package to roll back to yet, so activation simply stays empty.
 */
export class ConfigurationEngine implements IConfigurationEngine {
  private activeConfiguration: ConfigurationPackage | undefined;

  async initialize(): Promise<void> {
    const candidate = sampleConfiguration as ConfigurationPackage;

    if (!isValidConfigurationPackage(candidate)) {
      LoggerService.error(CONFIGURATION_ENGINE_INVALID_PACKAGE_MESSAGE);
      this.activeConfiguration = undefined;
      return;
    }

    this.activeConfiguration = candidate;
  }

  getActiveConfiguration(): ConfigurationPackage | undefined {
    return this.activeConfiguration;
  }

  getScreen(screenId: string): ScreenDefinition | undefined {
    return this.activeConfiguration?.screens.find((screen) => screen.screenId === screenId);
  }

  dispose(): void {
    this.activeConfiguration = undefined;
  }
}
