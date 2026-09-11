import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';

import { CaseForceProceedDialog } from './case-force-proceed-dialog';
import { CaseLocationSection } from './case-location-section';
import type { CaseLocationSectionProps } from './case-location-section';

const onGetDirections = jest.fn();
const onRecalculate = jest.fn();
const onForceProceedPress = jest.fn();

function buildProps(overrides: Partial<CaseLocationSectionProps> = {}): CaseLocationSectionProps {
  return {
    address: 'Flat 204, Madhapur, Hyderabad',
    caseCoordinates: { latitude: 17.4452, longitude: 78.3821 },
    geoFenceStatus: 'inside',
    distanceMeters: 42,
    distanceMethod: 'local',
    radiusMeters: 200,
    isCaseLocationFromCache: false,
    unresolvedReason: null,
    remainingAttempts: 3,
    canForceProceed: false,
    isGeoFenceBypassed: false,
    isBusy: false,
    onGetDirections,
    onRecalculate,
    onForceProceedPress,
    ...overrides,
  };
}

/** `render` and `fireEvent` are async in React Native Testing Library 14. */
async function renderSection(overrides: Partial<CaseLocationSectionProps> = {}): Promise<void> {
  await render(
    <ThemeProvider>
      <CaseLocationSection {...buildProps(overrides)} />
    </ThemeProvider>,
  );
}

describe('CaseLocationSection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('shows a finding-distance indicator while measuring', async () => {
    await renderSection({ geoFenceStatus: 'measuring', isBusy: true, distanceMeters: null });

    expect(screen.getByTestId('case-details-geo-fence-loading')).toBeTruthy();
    expect(screen.getByText('Finding your distance from the case address…')).toBeTruthy();
    expect(screen.queryByTestId('case-details-gps-banner')).toBeNull();
  });

  it('shows a resolving-location indicator while geocoding the address', async () => {
    await renderSection({
      geoFenceStatus: 'resolving_case_location',
      isBusy: true,
      caseCoordinates: null,
      distanceMeters: null,
      distanceMethod: null,
    });

    expect(screen.getByText('Determining the case location…')).toBeTruthy();
  });

  it('confirms the match, with no retry affordance, when inside the fence', async () => {
    await renderSection();

    expect(screen.getByTestId('case-details-gps-banner')).toBeTruthy();
    expect(screen.getByText('GPS Match: 42m from address')).toBeTruthy();
    expect(screen.queryByTestId('case-details-recalculate-button')).toBeNull();
    expect(screen.queryByTestId('case-details-force-proceed-button')).toBeNull();
  });

  it('offers Recalculate when outside the fence', async () => {
    await renderSection({ geoFenceStatus: 'outside', distanceMeters: 2100 });

    expect(
      screen.getByText(
        'GPS Alert: 2100m from address. You must be within 200m of the address to continue.',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('case-details-recalculate-button'));
    expect(onRecalculate).toHaveBeenCalledTimes(1);
  });

  it('shows how many recalculation attempts remain', async () => {
    await renderSection({ geoFenceStatus: 'outside', distanceMeters: 2100, remainingAttempts: 2 });

    expect(screen.getByTestId('case-details-remaining-attempts')).toBeTruthy();
    expect(screen.queryByTestId('case-details-force-proceed-button')).toBeNull();
  });

  it('offers Proceed Without Distance only once the retry budget is spent', async () => {
    await renderSection({
      geoFenceStatus: 'outside',
      distanceMeters: 2100,
      remainingAttempts: 0,
      canForceProceed: true,
    });

    await fireEvent.press(screen.getByTestId('case-details-force-proceed-button'));
    expect(onForceProceedPress).toHaveBeenCalledTimes(1);
  });

  it('replaces the Force Proceed button with a scrutiny notice once bypassed', async () => {
    await renderSection({
      geoFenceStatus: 'outside',
      distanceMeters: 2100,
      remainingAttempts: 0,
      canForceProceed: true,
      isGeoFenceBypassed: true,
    });

    expect(screen.queryByTestId('case-details-force-proceed-button')).toBeNull();
    expect(screen.getByTestId('case-details-geo-fence-bypass-notice')).toBeTruthy();
  });

  it('tells the user to reconnect when an address-only case could not be resolved offline', async () => {
    await renderSection({
      geoFenceStatus: 'case_location_unresolved',
      unresolvedReason: 'offline',
      caseCoordinates: null,
      distanceMeters: null,
      distanceMethod: null,
    });

    expect(
      screen.getByText(
        'Case location could not be determined. Connect to the internet and try again.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('case-details-recalculate-button')).toBeTruthy();
  });

  it('refuses the check when the server configuration is unavailable', async () => {
    await renderSection({
      geoFenceStatus: 'configuration_unavailable',
      radiusMeters: null,
      distanceMeters: null,
      distanceMethod: null,
    });

    expect(screen.getByTestId('case-details-geo-fence-configuration-error')).toBeTruthy();
    expect(screen.queryByTestId('case-details-gps-banner')).toBeNull();
    expect(screen.queryByTestId('case-details-force-proceed-button')).toBeNull();

    // Retry is offered so a failed configuration fetch is recoverable.
    await fireEvent.press(screen.getByTestId('case-details-configuration-retry-button'));
    expect(onRecalculate).toHaveBeenCalledTimes(1);
  });

  it('waits quietly while the device location is still being resolved', async () => {
    await renderSection({
      geoFenceStatus: 'awaiting_location',
      distanceMeters: null,
      distanceMethod: null,
    });

    expect(screen.getByTestId('case-details-geo-fence-awaiting-location')).toBeTruthy();
  });

  it('hides the coordinates chip until the case location is known', async () => {
    await renderSection({ caseCoordinates: null });

    expect(screen.queryByText(/Lat:/)).toBeNull();
  });

  it('discloses which strategy produced the distance', async () => {
    await renderSection({ distanceMethod: 'directions' });

    expect(screen.getByText('Distance measured by road route.')).toBeTruthy();
  });

  it('flags a case location served from the offline cache', async () => {
    await renderSection({ isCaseLocationFromCache: true });

    expect(screen.getByTestId('case-details-cached-location-note')).toBeTruthy();
  });

  it('still offers directions', async () => {
    await renderSection();

    // An icon replaces the old "Directions >" text; the label stays for screen readers.
    expect(screen.getByTestId('case-details-directions-icon')).toBeTruthy();
    expect(screen.queryByText('Directions')).toBeNull();
    expect(screen.getByLabelText('Directions')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('case-details-location-link'));
    expect(onGetDirections).toHaveBeenCalledTimes(1);
  });
});

describe('CaseForceProceedDialog', () => {
  const onCancel = jest.fn();
  const onAgree = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
  });

  async function renderDialog(isOpen = true): Promise<void> {
    await render(
      <ThemeProvider>
        <CaseForceProceedDialog isOpen={isOpen} onCancel={onCancel} onAgree={onAgree} />
      </ThemeProvider>,
    );
  }

  it('states the scrutiny consequence plainly', async () => {
    await renderDialog();

    expect(
      screen.getByText(
        'This case will be scrutinized after submission because the geo-fence requirement was not met.',
      ),
    ).toBeTruthy();
  });

  it('cancels without consenting', async () => {
    await renderDialog();

    await fireEvent.press(screen.getByTestId('case-force-proceed-cancel-button'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();
  });

  it('consents only through the explicit Agree action', async () => {
    await renderDialog();

    await fireEvent.press(screen.getByTestId('case-force-proceed-agree-button'));

    expect(onAgree).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed', async () => {
    await renderDialog(false);

    expect(screen.queryByTestId('case-force-proceed-agree-button')).toBeNull();
  });
});
