import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CaseListCache } from '@/features/cases';
import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';
import { KeyValueStorageService } from '@/infrastructure/storage';
import * as authenticationRepository from '@/repositories/authentication-repository';
import * as caseRepository from '@/repositories/case-repository';
import * as referenceDataRepository from '@/repositories/reference-data-repository';
import type { ReferenceData } from '@/domain/reference-data';

import { RootNavigator } from './root-navigator';

jest.mock('@/repositories/authentication-repository');
jest.mock('@/repositories/case-repository');
jest.mock('@/repositories/reference-data-repository');

/** Fixed by the master-data-sync contract. */
const MASTER_DATA_CACHE_KEY = 'master-data:v1';
const MASTER_DATA_VERSION = '2026-10-04T09:15:02.481Z';

const REFERENCE_DATA: ReferenceData = {
  updatedAt: MASTER_DATA_VERSION,
  verificationTypeStatuses: [],
  utvOptions: [],
  insuffOptions: [],
  photoTypes: [],
  componentStatuses: [],
  actionStatuses: [],
  profileStatuses: [],
  mobileAppSettings: { values: {}, updatedAt: null },
};

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
    // The profile the drawer shows comes from `login()` itself — no separate profile request.
    jest.mocked(authenticationRepository.login).mockResolvedValue({
      fieldExecutive: {
        id: 'fe-001',
        name: 'Amit Verma',
        email: 'amit.verma@fullscan.example',
        role: 'Field Agent',
      },
      masterDataUpdatedAt: MASTER_DATA_VERSION,
    });
    jest.mocked(authenticationRepository.logout).mockResolvedValue(undefined);
    jest.mocked(caseRepository.fetchCaseCounts).mockResolvedValue({
      new: 1,
      pending: 0,
      beyondTat: 0,
      completed: 0,
    });
    jest.mocked(caseRepository.fetchCasesPage).mockResolvedValue({
      items: [
        {
          id: 'case-1',
          checkId: 'case-1',
          caseRef: 'FS-2026-00001',
          clientName: 'ABC Pvt Ltd',
          candidateName: 'Rahul Sharma',
          verificationType: 'Address',
          address: 'Flat 204, Madhapur, Hyderabad',
          updatedAt: new Date('2026-10-04T09:15:02.000Z'),
        },
      ],
      nextCursor: null,
    });
    CaseListCache.clear();
    jest.mocked(referenceDataRepository.loadReferenceData).mockResolvedValue(REFERENCE_DATA);
    KeyValueStorageService.remove(MASTER_DATA_CACHE_KEY);
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    CaseListCache.clear();
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
    expect(referenceDataRepository.loadReferenceData).toHaveBeenCalledWith(MASTER_DATA_VERSION);
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

  it('drops the in-memory case-list cache on logout — it holds candidate PII', async () => {
    await render(
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>,
    );

    await loginAndOpenDrawer();
    await waitFor(() => expect(CaseListCache.getSnapshot().tabs.new?.items).toHaveLength(1));
    await waitFor(() => expect(CaseListCache.getSnapshot().counts).not.toBeNull());

    await fireEvent.press(screen.getByTestId('drawer-logout-button'));

    await waitFor(() => expect(screen.getByText('Welcome to FullScan')).toBeTruthy());
    expect(CaseListCache.getSnapshot().tabs).toEqual({});
    expect(CaseListCache.getSnapshot().counts).toBeNull();
  });

  it('keeps the persisted master-data cache on logout, so the next login can skip the fetch', async () => {
    // Stands in for the copy the repository persisted at login (it's mocked here).
    KeyValueStorageService.setObject(MASTER_DATA_CACHE_KEY, REFERENCE_DATA);
    await render(
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>,
    );

    await loginAndOpenDrawer();
    await waitFor(() => expect(screen.getByTestId('drawer-logout-button')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('drawer-logout-button'));

    await waitFor(() => expect(screen.getByText('Welcome to FullScan')).toBeTruthy());
    expect(KeyValueStorageService.getObject(MASTER_DATA_CACHE_KEY)).toEqual(REFERENCE_DATA);
  });
});
