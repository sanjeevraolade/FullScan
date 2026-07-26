import { LocalizationEngine } from '@/localization';
import { ThemeEngine } from '@/theme';

import { VerificationRuntimeEngine } from './runtime-engine';

describe('VerificationRuntimeEngine', () => {
  let engine: VerificationRuntimeEngine;

  afterEach(() => {
    engine.dispose();
  });

  it('initializes configuration, theme, localization and the widget registry together', async () => {
    engine = new VerificationRuntimeEngine();

    await engine.initialize();

    const context = engine.getContext();

    expect(context.activeConfiguration?.configurationVersion).toBe('1.0.0');
    expect(context.language).toBe('en');
    expect(context.theme.tokens).toEqual(ThemeEngine.getTokens());
  });

  it('exposes a widget registry that can register and resolve widgets', async () => {
    engine = new VerificationRuntimeEngine();
    await engine.initialize();

    engine.getWidgetRegistry().register('text', () => () => null);

    expect(engine.getWidgetRegistry().isRegistered('text')).toBe(true);
  });

  it('resolves a screen definition from the active configuration', async () => {
    engine = new VerificationRuntimeEngine();
    await engine.initialize();

    expect(engine.getScreen('runtime-preview')?.screenId).toBe('runtime-preview');
    expect(engine.getScreen('does-not-exist')).toBeUndefined();
  });

  it('resets every dependency on dispose', async () => {
    engine = new VerificationRuntimeEngine();
    await engine.initialize();

    engine.dispose();

    expect(engine.getContext().activeConfiguration).toBeUndefined();
    expect(engine.getContext().language).toBe('en');
    expect(LocalizationEngine.getLanguage()).toBe('en');
  });
});
