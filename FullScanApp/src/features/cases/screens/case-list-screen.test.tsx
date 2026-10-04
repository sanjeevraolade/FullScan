import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ROUTE_NAMES } from '@/navigation/routes';
import * as caseRepository from '@/repositories/case-repository';
import { ThemeProvider } from '@/theme';
import type { Case, CaseBucketCounts } from '@/domain/case';
import type { DrawerParamList } from '@/navigation/routes';
import type { CasePage } from '@/repositories/case-repository';

import { CaseListCache } from '../services/case-list-cache';

import { CaseListScreen } from './case-list-screen';

jest.mock('@/repositories/case-repository');

const Drawer = createDrawerNavigator<DrawerParamList>();

const COUNTS: CaseBucketCounts = { new: 7, pending: 10, beyondTat: 3, completed: 4 };

function buildCase(id: string): Case {
  return {
    id,
    checkId: id,
    caseRef: `FS-2026-${id}`,
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'Flat 204, Madhapur, Hyderabad',
    updatedAt: new Date('2026-10-04T09:15:02.000Z'),
  };
}

function page(ids: string[], nextCursor: string | null = null): CasePage {
  return { items: ids.map(buildCase), nextCursor };
}

/** Serves pages from a `bucket:cursor` table (`first` for a first page); anything else fails. */
function mockPages(responses: Record<string, CasePage | Error | Promise<CasePage>>): void {
  jest.mocked(caseRepository.fetchCasesPage).mockImplementation(async (bucket, cursor) => {
    const response = responses[`${bucket}:${cursor ?? 'first'}`];
    if (response === undefined || response instanceof Error) {
      throw response ?? new Error(`unexpected page request ${bucket}:${cursor ?? 'first'}`);
    }
    return response;
  });
}

/** `render` and `fireEvent` are async in React Native Testing Library 14. */
async function renderCaseList(): Promise<void> {
  await render(
    <ThemeProvider>
      <NavigationContainer>
        <Drawer.Navigator>
          <Drawer.Screen name={ROUTE_NAMES.CASE_LIST} component={CaseListScreen} />
        </Drawer.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

function expectTabsVisible(): void {
  expect(screen.getByTestId('case-bucket-tab-new')).toBeTruthy();
  expect(screen.getByTestId('case-bucket-tab-pending')).toBeTruthy();
  expect(screen.getByTestId('case-bucket-tab-beyondTat')).toBeTruthy();
  expect(screen.getByTestId('case-bucket-tab-completed')).toBeTruthy();
}

describe('CaseListScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    CaseListCache.clear();
    await LocalizationEngine.initialize();
    jest.mocked(caseRepository.fetchCaseCounts).mockResolvedValue(COUNTS);
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    CaseListCache.clear();
  });

  it('keeps the tabs on screen while the first page loads', async () => {
    mockPages({ 'new:first': new Promise<CasePage>(() => undefined) });

    await renderCaseList();

    expect(screen.getByTestId('case-list-loading-spinner')).toBeTruthy();
    expectTabsVisible();
    expect(screen.queryByTestId('case-list')).toBeNull();
  });

  it('keeps the tabs usable on a first-page error, and Retry reloads the tab', async () => {
    mockPages({ 'new:first': new Error('offline'), 'pending:first': page(['p1']) });

    await renderCaseList();

    await waitFor(() => expect(screen.getByTestId('case-list-error-alert')).toBeTruthy());
    expectTabsVisible();
    expect(
      screen.getByText('Unable to load cases. Check your connection and try again.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('case-bucket-tab-pending'));
    await waitFor(() => expect(screen.getByTestId('case-card-p1')).toBeTruthy());
    expect(screen.queryByTestId('case-list-error-alert')).toBeNull();

    await fireEvent.press(screen.getByTestId('case-bucket-tab-new'));
    expect(screen.getByTestId('case-list-error-alert')).toBeTruthy();

    mockPages({ 'new:first': page(['n1']), 'pending:first': page(['p1']) });
    await fireEvent.press(screen.getByTestId('case-list-error-retry-button'));

    await waitFor(() => expect(screen.getByTestId('case-card-n1')).toBeTruthy());
    expect(screen.queryByTestId('case-list-error-alert')).toBeNull();
  });

  it('shows a footer retry when a next page fails, keeping the loaded cases', async () => {
    mockPages({
      'new:first': page(['n1', 'n2'], 'cursor-1'),
      'new:cursor-1': new Error('offline'),
    });

    await renderCaseList();
    await waitFor(() => expect(screen.getByTestId('case-card-n1')).toBeTruthy());

    await fireEvent(screen.getByTestId('case-list'), 'onEndReached');

    await waitFor(() => expect(screen.getByTestId('case-list-load-more-alert')).toBeTruthy());
    expect(screen.getByText("Couldn't load more cases.")).toBeTruthy();
    expect(screen.getByTestId('case-card-n1')).toBeTruthy();
    expect(screen.getByTestId('case-card-n2')).toBeTruthy();
    expect(screen.queryByTestId('case-list-error-alert')).toBeNull();

    mockPages({ 'new:first': page(['n1', 'n2'], 'cursor-1'), 'new:cursor-1': page(['n3']) });
    await fireEvent.press(screen.getByTestId('case-list-load-more-retry-button'));

    await waitFor(() => expect(screen.getByTestId('case-card-n3')).toBeTruthy());
    expect(screen.queryByTestId('case-list-load-more-alert')).toBeNull();
  });

  it('shows a footer spinner while the next page loads', async () => {
    mockPages({
      'new:first': page(['n1'], 'cursor-1'),
      'new:cursor-1': new Promise<CasePage>(() => undefined),
    });

    await renderCaseList();
    await waitFor(() => expect(screen.getByTestId('case-card-n1')).toBeTruthy());

    await fireEvent(screen.getByTestId('case-list'), 'onEndReached');

    await waitFor(() => expect(screen.getByTestId('case-list-load-more-spinner')).toBeTruthy());
    expect(screen.getByTestId('case-card-n1')).toBeTruthy();
  });

  it('badges a fully loaded tab with its item count and the rest with the server count', async () => {
    mockPages({ 'new:first': page(['n1', 'n2']) });

    await renderCaseList();

    await waitFor(() => expect(screen.getByText('Pending (10)')).toBeTruthy());
    // The server drew 7 for New, but 2 are loaded and the list is complete.
    expect(screen.getByText('New (2)')).toBeTruthy();
    expect(screen.getByText('TAT (3)')).toBeTruthy();
    expect(screen.getByText('Completed (4)')).toBeTruthy();
  });

  it('shows the tab label alone while there is no count', async () => {
    jest.mocked(caseRepository.fetchCaseCounts).mockRejectedValue(new Error('offline'));
    mockPages({ 'new:first': page(['n1']) });

    await renderCaseList();

    await waitFor(() => expect(screen.getByText('New (1)')).toBeTruthy());
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('TAT')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('offers Accept on the New tab and Call on the Pending tab', async () => {
    mockPages({ 'new:first': page(['n1']), 'pending:first': page(['p1']) });

    await renderCaseList();
    await waitFor(() => expect(screen.getByTestId('case-card-accept-n1')).toBeTruthy());
    expect(screen.queryByTestId('case-card-call-n1')).toBeNull();

    await fireEvent.press(screen.getByTestId('case-bucket-tab-pending'));

    await waitFor(() => expect(screen.getByTestId('case-card-call-p1')).toBeTruthy());
    expect(screen.queryByTestId('case-card-accept-p1')).toBeNull();
  });
});
