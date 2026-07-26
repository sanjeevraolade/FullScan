import type { ConfigurationPackage } from '@/contracts';
import type { SupportedLanguage } from '@/localization';
import type { ResolvedThemeMode, ThemeMode, ThemeTokens } from '@/theme';

/**
 * Per docs/04-Runtime/01-Verification-Runtime-Engine.md §8 — the single
 * source of current execution state. Only the fields this pass actually
 * populates are declared (theme, language, active configuration); Assignment,
 * Candidate, Attachments, GPS, Form Data etc. belong to business-feature work
 * that is out of scope for the Runtime Engine core.
 */
export interface RuntimeContext {
  readonly theme: {
    readonly mode: ThemeMode;
    readonly resolvedMode: ResolvedThemeMode;
    readonly tokens: ThemeTokens;
  };
  readonly language: SupportedLanguage;
  readonly activeConfiguration: ConfigurationPackage | undefined;
}
