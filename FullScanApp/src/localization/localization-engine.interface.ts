import type { SupportedLanguage } from './localization-engine.types';

export interface ILocalizationEngine {
  initialize(language?: SupportedLanguage): Promise<void>;
  getLanguage(): SupportedLanguage;
  setLanguage(language: SupportedLanguage): Promise<void>;
  resolve(key: string): string;
  dispose(): void;
}
