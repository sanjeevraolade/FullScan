import { Appearance } from 'react-native';

import { DARK_THEME_TOKENS, LIGHT_THEME_TOKENS } from './default-theme';
import type { IThemeEngine } from './theme-engine.interface';
import type { ResolvedThemeMode, ThemeMode, ThemeTokens } from './theme.types';

const DEFAULT_MODE: ThemeMode = 'system';

class ThemeEngineImpl implements IThemeEngine {
  private mode: ThemeMode = DEFAULT_MODE;

  initialize(mode: ThemeMode = DEFAULT_MODE): void {
    this.mode = mode;
  }

  getMode(): ThemeMode {
    return this.mode;
  }

  getResolvedMode(): ResolvedThemeMode {
    if (this.mode === 'system') {
      return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
    }
    return this.mode;
  }

  getTokens(): ThemeTokens {
    return this.getResolvedMode() === 'dark' ? DARK_THEME_TOKENS : LIGHT_THEME_TOKENS;
  }

  dispose(): void {
    this.mode = DEFAULT_MODE;
  }
}

export const ThemeEngine: IThemeEngine = new ThemeEngineImpl();
