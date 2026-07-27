import { Appearance } from 'react-native';

import { LoggerService } from '@/infrastructure/logger';

import { DARK_THEME_TOKENS, LIGHT_THEME_TOKENS } from './default-theme';
import type { IThemeEngine } from './theme-engine.interface';
import type { ResolvedThemeMode, ThemeMode, ThemeTokens } from './theme.types';

const FILE_NAME = 'theme-engine.ts';
const DEFAULT_MODE: ThemeMode = 'system';

class ThemeEngineImpl implements IThemeEngine {
  private mode: ThemeMode = DEFAULT_MODE;

  initialize(mode: ThemeMode = DEFAULT_MODE): void {
    LoggerService.info(`${FILE_NAME}: ThemeEngine.initialize: starting`, { mode });
    this.mode = mode;
  }

  getMode(): ThemeMode {
    return this.mode;
  }

  getResolvedMode(): ResolvedThemeMode {
    if (this.mode === 'system') {
      const resolvedMode = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
      LoggerService.info(`${FILE_NAME}: ThemeEngine.getResolvedMode: resolved system mode`, { resolvedMode });
      return resolvedMode;
    }
    return this.mode;
  }

  getTokens(): ThemeTokens {
    return this.getResolvedMode() === 'dark' ? DARK_THEME_TOKENS : LIGHT_THEME_TOKENS;
  }

  dispose(): void {
    LoggerService.info(`${FILE_NAME}: ThemeEngine.dispose: resetting to default mode`);
    this.mode = DEFAULT_MODE;
  }
}

export const ThemeEngine: IThemeEngine = new ThemeEngineImpl();
