import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';

import { FormTextField, type FormTextFieldHandle } from './form-text-field';

/** `render` and `fireEvent` are async in React Native Testing Library 14. */
async function renderWithProviders(node: React.ReactElement): Promise<void> {
  await render(<ThemeProvider>{node}</ThemeProvider>);
}

describe('FormTextField', () => {
  beforeEach(async () => {
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('renders the label and input for a plain field', async () => {
    await renderWithProviders(
      <FormTextField fieldId="username" labelKey="login.fields.username" value="" onChangeText={jest.fn()} />,
    );

    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByTestId('username-input')).toBeTruthy();
  });

  it('shows the error text when an errorKey is provided', async () => {
    await renderWithProviders(
      <FormTextField
        fieldId="username"
        labelKey="login.fields.username"
        value=""
        onChangeText={jest.fn()}
        errorKey="validation.required"
      />,
    );

    expect(screen.getByTestId('username-error')).toHaveTextContent('This field is required');
  });

  it('does not render a visibility toggle for a non-secure field', async () => {
    await renderWithProviders(
      <FormTextField fieldId="username" labelKey="login.fields.username" value="" onChangeText={jest.fn()} />,
    );

    expect(screen.queryByTestId('username-toggle-visibility')).toBeNull();
  });

  it('masks input by default on a secure field and reveals it via the visibility toggle', async () => {
    await renderWithProviders(
      <FormTextField
        fieldId="password"
        labelKey="login.fields.password"
        value=""
        onChangeText={jest.fn()}
        isSecure
      />,
    );

    expect(screen.getByTestId('password-input').props['secureTextEntry']).toBe(true);
    expect(screen.getByTestId('password-toggle-visibility').props['accessibilityLabel']).toBe(
      'Show password',
    );

    await fireEvent.press(screen.getByTestId('password-toggle-visibility'));

    expect(screen.getByTestId('password-input').props['secureTextEntry']).toBe(false);
    expect(screen.getByTestId('password-toggle-visibility').props['accessibilityLabel']).toBe(
      'Hide password',
    );

    await fireEvent.press(screen.getByTestId('password-toggle-visibility'));

    expect(screen.getByTestId('password-input').props['secureTextEntry']).toBe(true);
  });

  it('forwards returnKeyType and onSubmitEditing to the underlying input', async () => {
    const onSubmitEditing = jest.fn();
    await renderWithProviders(
      <FormTextField
        fieldId="username"
        labelKey="login.fields.username"
        value=""
        onChangeText={jest.fn()}
        returnKeyType="next"
        onSubmitEditing={onSubmitEditing}
      />,
    );

    const input = screen.getByTestId('username-input');
    expect(input.props['returnKeyType']).toBe('next');

    await fireEvent(input, 'submitEditing');
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  it('exposes a focus() handle that can move focus to the underlying input', async () => {
    const fieldHandle = createRef<FormTextFieldHandle>();
    await renderWithProviders(
      <FormTextField
        ref={fieldHandle}
        fieldId="username"
        labelKey="login.fields.username"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(fieldHandle.current).not.toBeNull();
    expect(() => fieldHandle.current?.focus()).not.toThrow();
  });
});
