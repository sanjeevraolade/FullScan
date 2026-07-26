import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en/common.json';
import hi from './hi/common.json';
import te from './te/common.json';
import type { ILocalizationEngine } from './localization-engine.interface';
import type { SupportedLanguage } from './localization-engine.types';

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const RESOURCES = {
  en: { common: en },
  hi: { common: hi },
  te: { common: te },
} as const;

class LocalizationEngineImpl implements ILocalizationEngine {
  private language: SupportedLanguage = DEFAULT_LANGUAGE;

  async initialize(language: SupportedLanguage = DEFAULT_LANGUAGE): Promise<void> {
    this.language = language;
    await i18next.use(initReactI18next).init({
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      defaultNS: 'common',
      resources: RESOURCES,
      interpolation: { escapeValue: false },
    });
  }

  getLanguage(): SupportedLanguage {
    return this.language;
  }

  async setLanguage(language: SupportedLanguage): Promise<void> {
    this.language = language;
    await i18next.changeLanguage(language);
  }

  resolve(key: string): string {
    return i18next.t(key);
  }

  dispose(): void {
    this.language = DEFAULT_LANGUAGE;
  }
}

export const LocalizationEngine: ILocalizationEngine = new LocalizationEngineImpl();
