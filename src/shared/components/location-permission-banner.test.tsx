import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';
import { useLocationStore } from '@/store/location';
import type { LocationReadinessStatus, LocationUnavailableReason } from '@/infrastructure/location';

import { LocationGuard } from './location-guard';
import { LocationPermissionBanner } from './location-permission-banner';
import { MockLocationBanner } from './mock-location-banner';

const requestPermission = jest.fn();
const openSettings = jest.fn();
const evaluate = jest.fn();

function seedStatus(
  status: LocationReadinessStatus,
  errorReason: LocationUnavailableReason | null = null,
): void {
  useLocationStore.setState({
    status,
    errorReason,
    location: null,
    isEvaluating: false,
    requestPermission,
    openSettings,
    evaluate,
  });
}

/** `render` and `fireEvent` are async in React Native Testing Library 14. */
async function renderWithProviders(node: React.ReactElement): Promise<void> {
  await render(<ThemeProvider>{node}</ThemeProvider>);
}

describe('LocationPermissionBanner', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    useLocationStore.getState().reset();
  });

  it('renders nothing while location is ready', async () => {
    seedStatus('ready');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(screen.queryByTestId('location-permission-banner')).toBeNull();
  });

  it('renders nothing before readiness has been evaluated', async () => {
    seedStatus('unknown');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(screen.queryByTestId('location-permission-banner')).toBeNull();
  });

  it('shows the mandatory message with a grant action when the permission is askable', async () => {
    seedStatus('permission_required');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(screen.getByText('Location permission is mandatory to work.')).toBeTruthy();
    expect(screen.getByTestId('location-banner-grant-button')).toBeTruthy();
    expect(screen.queryByTestId('location-banner-settings-button')).toBeNull();
  });

  it('prompts for the permission when the grant action is tapped', async () => {
    seedStatus('permission_required');
    await renderWithProviders(<LocationPermissionBanner />);

    await fireEvent.press(screen.getByTestId('location-banner-grant-button'));

    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('offers Settings instead of a prompt when the permission is permanently denied', async () => {
    seedStatus('permission_denied');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(screen.getByTestId('location-banner-settings-button')).toBeTruthy();
    expect(screen.queryByTestId('location-banner-grant-button')).toBeNull();

    await fireEvent.press(screen.getByTestId('location-banner-settings-button'));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('tells the user to switch location services on', async () => {
    seedStatus('service_disabled');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(
      screen.getByText('Device location services are switched off. Turn location on to continue.'),
    ).toBeTruthy();
  });

  it('explains an unsupported device without offering a pointless action', async () => {
    seedStatus('unsupported');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(screen.getByTestId('location-permission-banner')).toBeTruthy();
    expect(screen.queryByTestId('location-banner-grant-button')).toBeNull();
    expect(screen.queryByTestId('location-banner-retry-button')).toBeNull();
  });

  it('offers a retry when a granted permission produced no fix', async () => {
    seedStatus('error', 'timeout');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(
      screen.getByText('Getting a GPS fix took too long. Move to an open area and retry.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('location-banner-retry-button'));
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('leaves the mock-location state to MockLocationBanner', async () => {
    seedStatus('mock_detected');

    await renderWithProviders(<LocationPermissionBanner />);

    expect(screen.queryByTestId('location-permission-banner')).toBeNull();
  });
});

describe('MockLocationBanner', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    useLocationStore.getState().reset();
  });

  it('renders nothing unless a mock location is detected', async () => {
    seedStatus('ready');

    await renderWithProviders(<MockLocationBanner />);

    expect(screen.queryByTestId('mock-location-banner')).toBeNull();
  });

  it('blocks with an explanation when a mock location is detected', async () => {
    seedStatus('mock_detected');

    await renderWithProviders(<MockLocationBanner />);

    expect(screen.getByTestId('mock-location-banner')).toBeTruthy();
    expect(screen.getByText('Mock location detected.')).toBeTruthy();
  });

  it('re-checks on demand so turning the mock app off clears the banner', async () => {
    seedStatus('mock_detected');
    await renderWithProviders(<MockLocationBanner />);

    await fireEvent.press(screen.getByTestId('mock-location-banner-retry-button'));

    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});

describe('LocationGuard', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    useLocationStore.getState().reset();
  });

  it('leaves the app untouched before login, even with an unresolved location', async () => {
    seedStatus('permission_denied');

    await renderWithProviders(
      <LocationGuard isEnforced={false}>
        <Text>App content</Text>
      </LocationGuard>,
    );

    expect(screen.getByText('App content')).toBeTruthy();
    expect(screen.queryByTestId('location-blocking-overlay')).toBeNull();
    expect(screen.queryByTestId('location-permission-banner')).toBeNull();
  });

  it('blocks interaction and shows the banner once enforced and not ready', async () => {
    seedStatus('permission_denied');

    await renderWithProviders(
      <LocationGuard isEnforced>
        <Text>App content</Text>
      </LocationGuard>,
    );

    // The content is still on screen (so the executive doesn't lose their
    // place) but hidden from assistive tech and covered by the blocker.
    expect(screen.queryByText('App content')).toBeNull();
    expect(screen.getByText('App content', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('location-blocking-overlay')).toBeTruthy();
    expect(screen.getByTestId('location-permission-banner')).toBeTruthy();
  });

  it('blocks interaction for a mock location too', async () => {
    seedStatus('mock_detected');

    await renderWithProviders(
      <LocationGuard isEnforced>
        <Text>App content</Text>
      </LocationGuard>,
    );

    expect(screen.getByTestId('location-blocking-overlay')).toBeTruthy();
    expect(screen.getByTestId('mock-location-banner')).toBeTruthy();
  });

  it('lets the app through when location is ready', async () => {
    seedStatus('ready');

    await renderWithProviders(
      <LocationGuard isEnforced>
        <Text>App content</Text>
      </LocationGuard>,
    );

    expect(screen.queryByTestId('location-blocking-overlay')).toBeNull();
    expect(screen.queryByTestId('location-permission-banner')).toBeNull();
    expect(screen.queryByTestId('mock-location-banner')).toBeNull();
  });
});
