import { config } from '@gluestack-ui/config';

import type { ThemeTokens } from './theme.types';

/**
 * Sourced directly from the Gluestack UI default palette rather than new hex
 * literals, per the "no hardcoded colors" rule — this is the mapping step
 * described in docs/04-Runtime/03-Dynamic-Form-Engine.md §16 ("Theme Engine
 * maps tokens to Gluestack UI").
 */
export const LIGHT_THEME_TOKENS: ThemeTokens = {
  primary: config.tokens.colors.primary500,
  background: config.tokens.colors.backgroundLight0,
};

export const DARK_THEME_TOKENS: ThemeTokens = {
  primary: config.tokens.colors.primary500,
  background: config.tokens.colors.backgroundDark0,
};
