import type { ResolvedThemeMode, ThemeMode, ThemeTokens } from './theme.types';

export interface IThemeEngine {
  initialize(mode?: ThemeMode): void;
  getMode(): ThemeMode;
  getResolvedMode(): ResolvedThemeMode;
  getTokens(): ThemeTokens;
  dispose(): void;
}
