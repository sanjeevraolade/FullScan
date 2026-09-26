import { LocalizationEngine } from './localization-engine';

describe('LocalizationEngine', () => {
  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('initializes with English by default and resolves known keys', async () => {
    await LocalizationEngine.initialize();

    expect(LocalizationEngine.getLanguage()).toBe('en');
    expect(LocalizationEngine.resolve('login.title')).toBe('Login');
    expect(LocalizationEngine.resolve('login.welcome')).toBe('Welcome to FullScan');
  });

  it('resolves Hindi and Telugu translations for the same keys', async () => {
    await LocalizationEngine.initialize('hi');
    expect(LocalizationEngine.resolve('login.fields.username')).toBe('उपयोगकर्ता नाम');

    await LocalizationEngine.setLanguage('te');
    expect(LocalizationEngine.getLanguage()).toBe('te');
    expect(LocalizationEngine.resolve('login.fields.username')).toBe('వినియోగదారు పేరు');
  });

  it('falls back to the raw key when a translation is missing', async () => {
    await LocalizationEngine.initialize();

    expect(LocalizationEngine.resolve('unknown.missing.key')).toBe('unknown.missing.key');
  });
});
