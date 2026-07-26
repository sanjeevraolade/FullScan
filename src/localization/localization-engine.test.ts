import { LocalizationEngine } from './localization-engine';

describe('LocalizationEngine', () => {
  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('initializes with English by default and resolves known keys', async () => {
    await LocalizationEngine.initialize();

    expect(LocalizationEngine.getLanguage()).toBe('en');
    expect(LocalizationEngine.resolve('screen.runtimePreview.title')).toBe('Runtime Preview');
    expect(LocalizationEngine.resolve('runtimePreview.helloMessage')).toBe('Hello Runtime');
  });

  it('resolves Hindi and Telugu translations for the same keys', async () => {
    await LocalizationEngine.initialize('hi');
    expect(LocalizationEngine.resolve('runtimePreview.helloMessage')).toBe('नमस्ते रनटाइम');

    await LocalizationEngine.setLanguage('te');
    expect(LocalizationEngine.getLanguage()).toBe('te');
    expect(LocalizationEngine.resolve('runtimePreview.helloMessage')).toBe('హలో రన్‌టైమ్');
  });

  it('falls back to the raw key when a translation is missing', async () => {
    await LocalizationEngine.initialize();

    expect(LocalizationEngine.resolve('unknown.missing.key')).toBe('unknown.missing.key');
  });
});
