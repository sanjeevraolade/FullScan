import type { ConfigurationPackage, ScreenDefinition } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { CONFIGURATION_ENGINE_INVALID_PACKAGE_MESSAGE } from './configuration-engine.constants';
import type { IConfigurationEngine } from './configuration-engine.interface';
import loginScreen from './screens/login.json';
import runtimePreviewScreen from './screens/runtime-preview.json';

/**
 * One JSON file per screen under `screens/` (easier to navigate/diff than a
 * single growing file — see the "split it" discussion). This is still a
 * source-authoring choice only: the assembly below is a runtime merge of
 * already bundle-time-embedded JSON (Metro inlines every one of these files
 * into the JS bundle regardless of how they're split), so it costs nothing
 * beyond this one array literal. A real downloaded Configuration Package
 * arrives over the wire as a single JSON payload either way.
 */
const SAMPLE_CONFIGURATION: ConfigurationPackage = {
  configurationVersion: '1.0.0',
  minimumAppVersion: '1.0.0',
  generatedOn: '2026-06-29T10:30:00Z',
  screens: [runtimePreviewScreen, loginScreen] as ScreenDefinition[],
};

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
    const candidate = SAMPLE_CONFIGURATION;

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
