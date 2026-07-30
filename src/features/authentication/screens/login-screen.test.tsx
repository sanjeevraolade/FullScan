import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';

import { LoginScreen } from './login-screen';

/** `render` and `fireEvent` are async in React Native Testing Library 14. */
async function renderLoginScreen(): Promise<void> {
  await render(
    <ThemeProvider>
      <LoginScreen />
    </ThemeProvider>,
  );
}

describe('LoginScreen', () => {
  beforeEach(async () => {
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('renders the login fields with localized labels', async () => {
    await renderLoginScreen();

    expect(screen.getByText('Welcome to FullScan')).toBeTruthy();
    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    expect(screen.getByText('Employee ID (optional)')).toBeTruthy();
    expect(screen.getByText('Remember me')).toBeTruthy();
    expect(screen.getByTestId('login-submit-button')).toBeTruthy();
  });

  it('blocks submit and shows a required error for each empty mandatory field', async () => {
    await renderLoginScreen();

    await fireEvent.press(screen.getByTestId('login-submit-button'));

    expect(screen.getByTestId('username-error')).toBeTruthy();
    expect(screen.getByTestId('password-error')).toBeTruthy();
    // employeeId is optional — it must never block submit.
    expect(screen.queryByTestId('employeeId-error')).toBeNull();
    expect(screen.getAllByText('This field is required')).toHaveLength(2);
  });

  it('clears validation errors once the mandatory fields are filled in', async () => {
    await renderLoginScreen();

    await fireEvent.press(screen.getByTestId('login-submit-button'));
    expect(screen.getByTestId('username-error')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'secret-value');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    expect(screen.queryByTestId('username-error')).toBeNull();
    expect(screen.queryByTestId('password-error')).toBeNull();
  });

  it('keeps the entered value in the field it belongs to', async () => {
    await renderLoginScreen();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');

    expect(screen.getByTestId('username-input').props['value']).toBe('field.executive');
    expect(screen.getByTestId('password-input').props['value']).toBe('');
  });

  it('renders the same screen in the active language', async () => {
    await LocalizationEngine.setLanguage('te');
    await renderLoginScreen();

    expect(screen.getByText('FullScanకి స్వాగతం')).toBeTruthy();
    expect(screen.getByText('వినియోగదారు పేరు')).toBeTruthy();
  });
});
