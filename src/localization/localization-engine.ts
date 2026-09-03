import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

import en from './en/common.json';
import hi from './hi/common.json';
import te from './te/common.json';
import type { ILocalizationEngine } from './localization-engine.interface';
import type { SupportedLanguage } from './localization-engine.types';

const FILE_NAME = 'localization-engine.ts';
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const RESOURCES = {
  en: { common: en },
  hi: { common: hi },
  te: { common: te },
} as const;

class LocalizationEngineImpl implements ILocalizationEngine {
  private language: SupportedLanguage = DEFAULT_LANGUAGE;

  async initialize(language: SupportedLanguage = DEFAULT_LANGUAGE): Promise<void> {
    LoggerService.info(`${FILE_NAME}: LocalizationEngine.initialize: starting`, { language });
    this.language = language;
    await i18next.use(initReactI18next).init({
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      defaultNS: 'common',
      resources: RESOURCES,
      interpolation: { escapeValue: false },
    });
    LoggerService.info(`${FILE_NAME}: LocalizationEngine.initialize: completed`, { language });
  }

  getLanguage(): SupportedLanguage {
    LoggerService.info(`${FILE_NAME}: LocalizationEngine.getLanguage: returning active language`, {
      language: this.language,
    });
    return this.language;
  }

  async setLanguage(language: SupportedLanguage): Promise<void> {
    LoggerService.info(`${FILE_NAME}: LocalizationEngine.setLanguage: switching language`, {
      from: this.language,
      to: language,
    });
    this.language = language;
    await i18next.changeLanguage(language);
    LoggerService.info(`${FILE_NAME}: LocalizationEngine.setLanguage: language switched`, {
      language,
    });
  }

  resolve(key: string): string {
    const resolvedValue = i18next.t(key);
    if (resolvedValue === key) {
      LoggerService.warn(`${FILE_NAME}: LocalizationEngine.resolve: no translation for key`, {
        key,
        language: this.language,
      });
    } else {
      LoggerService.info(`${FILE_NAME}: LocalizationEngine.resolve: key resolved`, {
        key,
        language: this.language,
      });
    }
    return resolvedValue;
  }

  dispose(): void {
    LoggerService.info(`${FILE_NAME}: LocalizationEngine.dispose: resetting to default language`);
    this.language = DEFAULT_LANGUAGE;
    LoggerService.info(`${FILE_NAME}: LocalizationEngine.dispose: completed`, {
      language: this.language,
    });
  }
}

export const LocalizationEngine: ILocalizationEngine = new LocalizationEngineImpl();
