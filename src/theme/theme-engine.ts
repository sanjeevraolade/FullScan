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
    LoggerService.info(`${FILE_NAME}: ThemeEngine.initialize: completed`, { mode: this.mode });
  }

  getMode(): ThemeMode {
    LoggerService.info(`${FILE_NAME}: ThemeEngine.getMode: returning configured mode`, {
      mode: this.mode,
    });
    return this.mode;
  }

  getResolvedMode(): ResolvedThemeMode {
    LoggerService.info(`${FILE_NAME}: ThemeEngine.getResolvedMode: starting`, { mode: this.mode });

    if (this.mode === 'system') {
      const resolvedMode = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
      LoggerService.info(`${FILE_NAME}: ThemeEngine.getResolvedMode: resolved system mode`, { resolvedMode });
      return resolvedMode;
    }

    LoggerService.info(`${FILE_NAME}: ThemeEngine.getResolvedMode: using explicit mode`, {
      resolvedMode: this.mode,
    });
    return this.mode;
  }

  getTokens(): ThemeTokens {
    LoggerService.info(`${FILE_NAME}: ThemeEngine.getTokens: starting`);
    const resolvedMode = this.getResolvedMode();
    const tokens = resolvedMode === 'dark' ? DARK_THEME_TOKENS : LIGHT_THEME_TOKENS;
    LoggerService.info(`${FILE_NAME}: ThemeEngine.getTokens: token set resolved`, { resolvedMode });
    return tokens;
  }

  dispose(): void {
    LoggerService.info(`${FILE_NAME}: ThemeEngine.dispose: resetting to default mode`);
    this.mode = DEFAULT_MODE;
    LoggerService.info(`${FILE_NAME}: ThemeEngine.dispose: completed`, { mode: this.mode });
  }
}

export const ThemeEngine: IThemeEngine = new ThemeEngineImpl();
