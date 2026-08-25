import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';
import * as caseRepository from '@/repositories/case-repository';
import * as fieldExecutiveRepository from '@/repositories/field-executive-repository';
import * as referenceDataRepository from '@/repositories/reference-data-repository';

import { RootNavigator } from './root-navigator';

jest.mock('@/repositories/field-executive-repository');
jest.mock('@/repositories/case-repository');
jest.mock('@/repositories/reference-data-repository');

async function loginAndOpenDrawer(): Promise<void> {
  await fireEvent.changeText(screen.getByTestId('username-input'), 'field.executive');
  await fireEvent.changeText(screen.getByTestId('password-input'), 'secret-value');
  await fireEvent.press(screen.getByTestId('login-submit-button'));

  await waitFor(() => expect(screen.getByTestId('case-list-menu-button')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('case-list-menu-button'));
}

describe('RootNavigator', () => {
  beforeEach(async () => {
    await LocalizationEngine.initialize();
    jest.mocked(fieldExecutiveRepository.fetchCurrentFieldExecutive).mockResolvedValue({
      id: 'fe-001',
      name: 'Amit Verma',
      email: 'amit.verma@fullscan.example',
      role: 'Field Agent',
    });
    jest.mocked(caseRepository.fetchCases).mockResolvedValue([]);
    jest.mocked(referenceDataRepository.fetchReferenceData).mockResolvedValue({
      verificationTypeStatuses: [],
      utvOptions: [],
      insuffOptions: [],
      photoTypes: [],
    });
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

  it('opens the drawer after login and shows the field executive identity', async () => {
    await render(
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>,
    );

    await loginAndOpenDrawer();

    await waitFor(() => expect(screen.getByTestId('drawer-field-executive-name')).toBeTruthy());
    expect(screen.getByTestId('drawer-field-executive-name')).toHaveTextContent('Amit Verma');
    expect(screen.getByTestId('drawer-field-executive-email')).toHaveTextContent('amit.verma@fullscan.example');
  });

  it('logs out from the drawer back to the Login screen', async () => {
    await render(
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>,
    );

    await loginAndOpenDrawer();
    await waitFor(() => expect(screen.getByTestId('drawer-logout-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('drawer-logout-button'));

    await waitFor(() => expect(screen.getByText('Welcome to FullScan')).toBeTruthy());
    expect(screen.getByTestId('login-submit-button')).toBeTruthy();
  });
});
