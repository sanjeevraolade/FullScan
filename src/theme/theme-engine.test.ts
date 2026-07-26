import { Appearance } from 'react-native';

import { DARK_THEME_TOKENS, LIGHT_THEME_TOKENS } from './default-theme';
import { ThemeEngine } from './theme-engine';

describe('ThemeEngine', () => {
  afterEach(() => {
    ThemeEngine.dispose();
    jest.restoreAllMocks();
  });

  it('defaults to system mode', () => {
    expect(ThemeEngine.getMode()).toBe('system');
  });

  it('resolves system mode from the device color scheme', () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');

    ThemeEngine.initialize('system');

    expect(ThemeEngine.getResolvedMode()).toBe('dark');
    expect(ThemeEngine.getTokens()).toEqual(DARK_THEME_TOKENS);
  });

  it('honours an explicit light mode regardless of device scheme', () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');

    ThemeEngine.initialize('light');

    expect(ThemeEngine.getResolvedMode()).toBe('light');
    expect(ThemeEngine.getTokens()).toEqual(LIGHT_THEME_TOKENS);
  });

  it('resets to the default mode on dispose', () => {
    ThemeEngine.initialize('dark');

    ThemeEngine.dispose();

    expect(ThemeEngine.getMode()).toBe('system');
  });
});
