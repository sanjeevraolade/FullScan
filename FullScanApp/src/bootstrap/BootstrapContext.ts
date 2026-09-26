import type { SupportedLanguage } from '@/localization';
import type { ThemeMode } from '@/theme';

/**
 * Shared, mutable state threaded through the Bootstrap Pipeline — each step
 * may read what earlier steps populated and write its own contribution.
 */
export interface BootstrapContext {
  themeMode?: ThemeMode;
  language?: SupportedLanguage;
}
