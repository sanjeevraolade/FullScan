import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { BIOMETRY_TYPE, STORAGE_TYPE } from 'react-native-keychain';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import * as authenticationRepository from '@/repositories/authentication-repository';
import * as fieldExecutiveRepository from '@/repositories/field-executive-repository';
import * as referenceDataRepository from '@/repositories/reference-data-repository';

import { LoginScreen } from './login-screen';

jest.mock('@/repositories/authentication-repository');
jest.mock('@/repositories/field-executive-repository');
jest.mock('@/repositories/reference-data-repository');

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainPlaceholderScreen(): React.ReactElement {
  return <Text>Main</Text>;
}

/**
 * `render` and `fireEvent` are async in React Native Testing Library 14.
 * Registered on a real Stack.Navigator (not just a bare `NavigationContainer`)
 * because `useLoginForm`/`useBiometricEnrollment` call `navigation.replace(MAIN)`
 * on success, which needs an actual `MAIN` route to replace into.
 */
async function renderLoginScreen(): Promise<void> {
  await render(
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={ROUTE_NAMES.LOGIN}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name={ROUTE_NAMES.LOGIN} component={LoginScreen} />
          <Stack.Screen name={ROUTE_NAMES.MAIN} component={MainPlaceholderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('LoginScreen', () => {
  beforeEach(async () => {
    await LocalizationEngine.initialize();
    jest.mocked(authenticationRepository.login).mockResolvedValue(undefined);
    jest.mocked(fieldExecutiveRepository.fetchCurrentFieldExecutive).mockResolvedValue({
      id: 'fe-001',
      name: 'Amit Verma',
      email: 'amit.verma@fullscan.example',
      role: 'Field Agent',
    });
    jest.mocked(referenceDataRepository.fetchReferenceData).mockResolvedValue({
      verificationTypeStatuses: [],
      utvOptions: [],
      insuffOptions: [],
      photoTypes: [],
      componentStatuses: [],
      actionStatuses: [],
      profileStatuses: [],
    });
    // `mockResolvedValue` (persistent, not "Once") isn't undone by `clearAllMocks`
    // in the afterEach below — reset these two to a known "unsupported" baseline
    // every test, so a prior test's persistent biometric setup never leaks in.
    jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(null);
    jest.mocked(Keychain.hasGenericPassword).mockResolvedValue(false);
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    jest.clearAllMocks();
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

  it('disables submit until both required fields are filled, then enables it', async () => {
    await renderLoginScreen();

    expect(screen.getByTestId('login-submit-button')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
    expect(screen.getByTestId('login-submit-button')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('password-input'), 'secret-value');
    expect(screen.getByTestId('login-submit-button')).toBeEnabled();
  });

  it('blocks submit and shows a required error for each empty mandatory field', async () => {
    await renderLoginScreen();

    // The submit button is disabled while required fields are empty, so it
    // cannot be pressed to trigger this validation — submit the same way a
    // user reaching "done" on the keyboard from an empty password field
    // would, which isn't gated by the button's disabled state.
    await fireEvent(screen.getByTestId('password-input'), 'submitEditing');

    expect(screen.getByTestId('username-error')).toBeTruthy();
    expect(screen.getByTestId('password-error')).toBeTruthy();
    // employeeId is optional — it must never block submit.
    expect(screen.queryByTestId('employeeId-error')).toBeNull();
    expect(screen.getAllByText('This field is required')).toHaveLength(2);
  });

  it('clears validation errors once the mandatory fields are filled in', async () => {
    await renderLoginScreen();

    await fireEvent(screen.getByTestId('password-input'), 'submitEditing');
    expect(screen.getByTestId('username-error')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'secret-value');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    expect(screen.queryByTestId('username-error')).toBeNull();
    expect(screen.queryByTestId('password-error')).toBeNull();

    // Let the login call settle so its promise doesn't outlive the test.
    await waitFor(() => expect(screen.queryByTestId('login-submit-spinner')).toBeNull());
  });

  it('shows the invalid-credentials error when the server rejects the login with 401', async () => {
    jest
      .mocked(authenticationRepository.login)
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
    await renderLoginScreen();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'wrong-password');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() =>
      expect(screen.getByTestId('login-error-alert')).toHaveTextContent(
        'Incorrect username or password. Please try again.',
      ),
    );
  });

  it('shows the server-unavailable error when the backend returns a 5xx status', async () => {
    jest
      .mocked(authenticationRepository.login)
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } });
    await renderLoginScreen();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'secret-value');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() =>
      expect(screen.getByTestId('login-error-alert')).toHaveTextContent(
        'FullScan is temporarily unavailable. Please try again later.',
      ),
    );
  });

  it('shows the network error when the request fails without a response', async () => {
    jest
      .mocked(authenticationRepository.login)
      .mockRejectedValueOnce({ isAxiosError: true, response: undefined });
    await renderLoginScreen();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'secret-value');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() =>
      expect(screen.getByTestId('login-error-alert')).toHaveTextContent(
        'Unable to connect. Check your internet connection and try again.',
      ),
    );
  });

  it('keeps the entered value in the field it belongs to', async () => {
    await renderLoginScreen();

    await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');

    expect(screen.getByTestId('username-input').props['value']).toBe('field.executive');
    expect(screen.getByTestId('password-input').props['value']).toBe('');
  });

  it('toggles password visibility when the show/hide affordance is pressed', async () => {
    await renderLoginScreen();

    expect(screen.getByTestId('password-input').props['secureTextEntry']).toBe(true);

    await fireEvent.press(screen.getByTestId('password-toggle-visibility'));
    expect(screen.getByTestId('password-input').props['secureTextEntry']).toBe(false);

    await fireEvent.press(screen.getByTestId('password-toggle-visibility'));
    expect(screen.getByTestId('password-input').props['secureTextEntry']).toBe(true);
  });

  it('renders the app version and copyright footer', async () => {
    await renderLoginScreen();

    expect(screen.getByTestId('login-footer-version')).toHaveTextContent('Version 1.0.0');
    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByTestId('login-footer-copyright')).toHaveTextContent(
      `© ${currentYear} FullScan. All rights reserved.`,
    );
  });

  it('renders the same screen in the active language', async () => {
    await LocalizationEngine.setLanguage('te');
    await renderLoginScreen();

    expect(screen.getByText('FullScanకి స్వాగతం')).toBeTruthy();
    expect(screen.getByText('వినియోగదారు పేరు')).toBeTruthy();
  });

  describe('biometric login', () => {
    it('hides the biometric login button when the device has no biometry', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(null);
      await renderLoginScreen();

      await waitFor(() => expect(screen.queryByTestId('biometric-login-button')).toBeNull());
    });

    it('hides the biometric login button when biometrics are supported but not yet enrolled', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      jest.mocked(Keychain.hasGenericPassword).mockResolvedValue(false);
      await renderLoginScreen();

      await waitFor(() => expect(screen.queryByTestId('biometric-login-button')).toBeNull());
    });

    it('shows the fingerprint icon and label when a fingerprint sensor is enrolled', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      jest.mocked(Keychain.hasGenericPassword).mockResolvedValue(true);
      await renderLoginScreen();

      await waitFor(() => expect(screen.getByText('Log in with fingerprint')).toBeTruthy());
    });

    it('shows the Face ID icon and label when Face ID is enrolled', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
      jest.mocked(Keychain.hasGenericPassword).mockResolvedValue(true);
      await renderLoginScreen();

      await waitFor(() => expect(screen.getByText('Log in with Face ID')).toBeTruthy());
    });

    it('re-authenticates through /auth/login with the stored password after a successful biometric prompt', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      jest.mocked(Keychain.hasGenericPassword).mockResolvedValue(true);
      jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
        username: 'field.executive',
        password: 'secret-value',
        service: 'com.fullscan.auth.biometric',
        storage: STORAGE_TYPE.AES_GCM,
      });
      await renderLoginScreen();

      await waitFor(() => expect(screen.getByTestId('biometric-login-button')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('biometric-login-button'));

      await waitFor(() =>
        expect(authenticationRepository.login).toHaveBeenCalledWith({
          username: 'field.executive',
          password: 'secret-value',
        }),
      );
      expect(fieldExecutiveRepository.fetchCurrentFieldExecutive).toHaveBeenCalled();
    });

    it('clears the vault and shows an error when the stored password is rejected by the server', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      jest.mocked(Keychain.hasGenericPassword).mockResolvedValue(true);
      jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
        username: 'field.executive',
        password: 'stale-password',
        service: 'com.fullscan.auth.biometric',
        storage: STORAGE_TYPE.AES_GCM,
      });
      jest
        .mocked(authenticationRepository.login)
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
      await renderLoginScreen();

      await waitFor(() => expect(screen.getByTestId('biometric-login-button')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('biometric-login-button'));

      await waitFor(() =>
        expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
          service: 'com.fullscan.auth.biometric',
        }),
      );
      expect(screen.getByTestId('biometric-login-error-alert')).toHaveTextContent(
        'Biometric verification failed. Please log in with your username and password.',
      );
    });

    it('shows a biometric error and leaves the vault intact when the prompt is cancelled', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      jest.mocked(Keychain.hasGenericPassword).mockResolvedValue(true);
      jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce(false);
      await renderLoginScreen();

      await waitFor(() => expect(screen.getByTestId('biometric-login-button')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('biometric-login-button'));

      await waitFor(() =>
        expect(screen.getByTestId('biometric-login-error-alert')).toHaveTextContent(
          'Biometric verification failed. Please log in with your username and password.',
        ),
      );
      expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    });
  });

  describe('biometric enrollment', () => {
    async function submitPasswordLogin(): Promise<void> {
      await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
      await fireEvent.changeText(screen.getByTestId('password-input'), 'secret-value');
      await fireEvent.press(screen.getByTestId('login-submit-button'));
    }

    it('offers to enable biometric login after a first successful password login on a supported device', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      await renderLoginScreen();

      await submitPasswordLogin();

      await waitFor(() => expect(screen.getByTestId('biometric-enrollment-dialog')).toBeTruthy());
    });

    it('does not offer biometric enrollment on a device without biometry', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(null);
      await renderLoginScreen();

      await submitPasswordLogin();

      await waitFor(() => expect(screen.queryByTestId('login-submit-spinner')).toBeNull());
      expect(Keychain.setGenericPassword).not.toHaveBeenCalledWith(
        'field.executive',
        expect.any(String),
        expect.objectContaining({ service: 'com.fullscan.auth.biometric' }),
      );
    });

    it('saves the biometric vault once enrollment is accepted and verified', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
        username: 'field.executive',
        password: 'secret-value',
        service: 'com.fullscan.auth.biometric',
        storage: STORAGE_TYPE.AES_GCM,
      });
      await renderLoginScreen();

      await submitPasswordLogin();
      await waitFor(() => expect(screen.getByTestId('biometric-enrollment-dialog')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('biometric-enrollment-accept'));

      await waitFor(() =>
        expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
          'field.executive',
          'secret-value',
          expect.objectContaining({ service: 'com.fullscan.auth.biometric' }),
        ),
      );
    });

    it('declines enrollment without saving the biometric vault', async () => {
      jest.mocked(Keychain.getSupportedBiometryType).mockResolvedValue(BIOMETRY_TYPE.FINGERPRINT);
      await renderLoginScreen();

      await submitPasswordLogin();
      await waitFor(() => expect(screen.getByTestId('biometric-enrollment-dialog')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('biometric-enrollment-skip'));

      await waitFor(() => expect(screen.queryByTestId('login-submit-spinner')).toBeNull());
      expect(Keychain.setGenericPassword).not.toHaveBeenCalledWith(
        'field.executive',
        expect.any(String),
        expect.objectContaining({ service: 'com.fullscan.auth.biometric' }),
      );
    });
  });
});
