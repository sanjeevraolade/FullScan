import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import type { CapturedPhotoEvidence } from '@/domain/case';
import type { DeviceLocation } from '@/infrastructure/location';

import { CaseCameraScreen } from './case-camera-screen';

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
}));

const DEVICE_LOCATION: DeviceLocation = {
  latitude: 17.4461,
  longitude: 78.3821,
  accuracyMeters: 6,
  isMockLocation: false,
  capturedAt: new Date('2026-09-04T09:00:00.000Z'),
  source: 'fresh',
};

const SESSION_PHOTO: CapturedPhotoEvidence = {
  filePath: '/data/user/0/com.fullscan/files/case-1/house-photo-1.jpg',
  latitude: 17.4461,
  longitude: 78.3821,
  accuracyMeters: 6,
  isMockLocation: false,
  capturedAt: new Date('2026-09-04T09:05:00.000Z'),
  documentTypeCode: 'house_photo_1',
};

/*
 * Only what `CaseCameraScreen` itself reads. The camera outputs go straight to
 * the stubbed `Camera` component, so empty objects stand in for the native
 * ones; `sessionPhotos` stays mutable so a test can say what the visit
 * produced. The hook has its own tests — this file is about navigation.
 */
const mockCameraState = {
  /* Just enough of a device for the screen to leave its "preparing camera" state. */
  device: { id: 'back-camera', position: 'back' },
  previewOutput: {},
  photoOutput: {},
  hasCameraPermission: true,
  requestCameraPermission: jest.fn().mockResolvedValue(true),
  location: DEVICE_LOCATION,
  isMockLocationDetected: false,
  locationErrorKey: null,
  isCapturing: false,
  captureErrorKey: null,
  sessionPhotos: [] as readonly CapturedPhotoEvidence[],
  capturePhoto: jest.fn().mockResolvedValue(null),
};

jest.mock('../hooks/use-case-camera', () => ({
  useCaseCamera: () => mockCameraState,
}));

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Stand-in for Case Details — this file is about the stack, not that screen. */
function CaseDetailsStub(): React.ReactElement {
  return <Text>Case Details</Text>;
}

/** Stand-in for the case list, so Case Details has somewhere to go back to. */
function PreviousScreen(): React.ReactElement {
  return <Text>Case List</Text>;
}

/** Walks the real path a field executive takes: case list → case details → camera. */
async function renderCameraOverCaseDetails(): Promise<void> {
  await render(
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={ROUTE_NAMES.MAIN}>
          <Stack.Screen name={ROUTE_NAMES.MAIN} component={PreviousScreen} />
          <Stack.Screen name={ROUTE_NAMES.CASE_DETAILS} component={CaseDetailsStub} />
          <Stack.Screen name={ROUTE_NAMES.CASE_CAMERA} component={CaseCameraScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  await act(async () => {
    navigationRef.navigate(ROUTE_NAMES.CASE_DETAILS, { caseId: 'case-1' });
  });
  await act(async () => {
    navigationRef.navigate(ROUTE_NAMES.CASE_CAMERA, {
      caseId: 'case-1',
      photoTagCode: 'house_photo_1',
      existingPhotos: [],
    });
  });
}

function getRouteNames(): readonly string[] {
  return (navigationRef.getRootState()?.routes ?? []).map((route) => route.name);
}

describe('CaseCameraScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
    mockCameraState.sessionPhotos = [SESSION_PHOTO];
  });

  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('unwinds to the Case Details that opened it, leaving no camera behind', async () => {
    await renderCameraOverCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-camera-done-button')).toBeTruthy());
    expect(getRouteNames()).toEqual([
      ROUTE_NAMES.MAIN,
      ROUTE_NAMES.CASE_DETAILS,
      ROUTE_NAMES.CASE_CAMERA,
    ]);

    await fireEvent.press(screen.getByTestId('case-camera-done-button'));

    // The camera must be gone and Case Details must not be duplicated —
    // otherwise Back from Case Details re-opens the camera.
    await waitFor(() =>
      expect(getRouteNames()).toEqual([ROUTE_NAMES.MAIN, ROUTE_NAMES.CASE_DETAILS]),
    );
  });

  it('hands the captured batch back to the Case Details screen it returns to', async () => {
    await renderCameraOverCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-camera-done-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-camera-done-button'));

    await waitFor(() => expect(getRouteNames()).toHaveLength(2));
    expect(navigationRef.getRootState()?.routes[1]?.params).toEqual({
      caseId: 'case-1',
      capturedPhotos: [
        {
          filePath: SESSION_PHOTO.filePath,
          latitude: SESSION_PHOTO.latitude,
          longitude: SESSION_PHOTO.longitude,
          accuracyMeters: SESSION_PHOTO.accuracyMeters,
          isMockLocation: SESSION_PHOTO.isMockLocation,
          capturedAtIso: SESSION_PHOTO.capturedAt.toISOString(),
          documentTypeCode: SESSION_PHOTO.documentTypeCode,
        },
      ],
    });
  });

  it('returns nothing to Case Details when the capture is cancelled', async () => {
    await renderCameraOverCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-camera-cancel-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-camera-cancel-button'));

    await waitFor(() =>
      expect(getRouteNames()).toEqual([ROUTE_NAMES.MAIN, ROUTE_NAMES.CASE_DETAILS]),
    );
    expect(navigationRef.getRootState()?.routes[1]?.params).toEqual({ caseId: 'case-1' });
  });
});
