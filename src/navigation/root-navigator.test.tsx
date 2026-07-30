import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';

import { RootNavigator } from './root-navigator';

describe('RootNavigator', () => {
  beforeEach(async () => {
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('lands on the Login screen as the initial route', async () => {
    await render(
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>,
    );

    expect(screen.getByText('Welcome to FullScan')).toBeTruthy();
    expect(screen.getByTestId('login-submit-button')).toBeTruthy();
  });
});
