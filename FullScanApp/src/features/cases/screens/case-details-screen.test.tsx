import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import * as caseRepository from '@/repositories/case-repository';
import * as caseEvidenceRepository from '@/repositories/case-evidence-repository';
import { CaseEvidenceUploadError } from '@/repositories/case-evidence-repository.errors';
import { GeocodingFailedError, GeocodingService } from '@/infrastructure/geocoding';
import type { Case, CaseDetail, UploadedCaseEvidence } from '@/domain/case';
import type { ReferenceData } from '@/domain/reference-data';
import type { DeviceLocation } from '@/infrastructure/location';
import { useLocationStore } from '@/store/location';
import { useGeoFenceBypassStore } from '@/store/geo-fence';
import { useReferenceDataStore } from '@/store/reference-data';
import type { SerializedCapturedPhotoEvidence } from '@/navigation/routes';

import { DraftStorageService } from '../services/draft-storage';
import { EvidenceReceiptStorageService } from '../services/evidence-receipt-storage';

import { CaseDetailsScreen } from './case-details-screen';

jest.mock('@/repositories/case-repository');
jest.mock('@/repositories/case-evidence-repository');
jest.mock('@/infrastructure/geocoding', () => {
  class TestGeocodingFailedError extends Error {
    readonly reason: string;

    constructor(reason: string, message: string) {
      super(message);
      this.name = 'GeocodingFailedError';
      this.reason = reason;
    }
  }

  return {
    GeocodingService: { resolveAddressCoordinates: jest.fn(), clearCache: jest.fn() },
    GeocodingFailedError: TestGeocodingFailedError,
    isGeocodingFailedError: (error: unknown) => error instanceof TestGeocodingFailedError,
  };
});

const Stack = createNativeStackNavigator<RootStackParamList>();

/** The case address; the device fix below sits ~100m away from it. */
const CASE_COORDINATES = { latitude: 17.4452, longitude: 78.3821 };
const DEVICE_LOCATION: DeviceLocation = {
  latitude: 17.4461,
  longitude: 78.3821,
  accuracyMeters: 6,
  isMockLocation: false,
  capturedAt: new Date('2026-09-04T09:00:00.000Z'),
  source: 'fresh',
};

const REFERENCE_DATA: ReferenceData = {
  updatedAt: null,
  verificationTypeStatuses: [
    { code: 'verified_clear', label: 'Verified Clear' },
    { code: 'utv', label: 'UTV' },
  ],
  utvOptions: [{ code: 'shifted', label: 'Shifted' }],
  insuffOptions: [{ code: 'incorrect_address', label: 'Incorrect Address' }],
  photoTypes: [{ code: 'house_photo_1', label: 'House Photo 1' }],
  componentStatuses: [{ code: 'component_accepted', label: 'Component Accepted' }],
  actionStatuses: [{ code: 'accepted', label: 'Accept/Approve' }],
  profileStatuses: [{ code: 'wip', label: 'WIP' }],
  mobileAppSettings: {
    values: { geo_fence_radius_meters: 200, locationRetryCount: 3 },
    updatedAt: '2026-09-03 14:17:05',
  },
};

function buildCaseDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'case-1',
    checkId: 'case-1',
    caseRef: 'FS-2026-00001',
    bucket: 'pending',
    tatDueAt: new Date('2026-09-30T00:00:00.000Z'),
    candidateName: 'Rahul Sharma',
    fatherOrSpouseName: 'Suresh Sharma',
    employerName: 'ABC Pvt Ltd',
    verificationType: 'Address',
    clientName: 'ABC Pvt Ltd',
    address: 'Flat 204, Madhapur, Hyderabad',
    addressType: 'present',
    residenceType: 'rented',
    coordinates: CASE_COORDINATES,
    maskedPrimaryPhone: '+91-XXXXX-00001',
    maskedSecondaryPhone: '+91-XXXXX-00002',
    clientInstructions: 'Verify residence address.',
    fieldExecutiveNotes: 'Gated community.',
    selectedVerificationStatus: null,
    respondent: null,
    componentStatus: 'component_accepted',
    actionStatus: null,
    profileStatus: 'wip',
    costRequested: null,
    insuffRaisedAt: null,
    insuffClearedAt: null,
    addlDocRequestedAt: null,
    addlDocClearedAt: null,
    costApprovalRequestedAt: null,
    costApprovedAt: null,
    costRejectedAt: null,
    siblingComponents: [],
    ...overrides,
  };
}

function buildCase(): Case {
  return {
    id: 'case-1',
    checkId: 'case-1',
    caseRef: 'FS-2026-00001',
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'Flat 204, Madhapur, Hyderabad',
    updatedAt: new Date('2026-09-04T09:00:00.000Z'),
  };
}

function seedGeoFenceSettings(radiusMeters: number, locationRetryCount = 3): void {
  useReferenceDataStore.setState({
    referenceData: {
      ...REFERENCE_DATA,
      mobileAppSettings: {
        values: { geo_fence_radius_meters: radiusMeters, locationRetryCount },
        updatedAt: '2026-09-03 14:17:05',
      },
    },
  });
}

/** `render` and `fireEvent` are async in React Native Testing Library 14. */
async function renderCaseDetails(): Promise<void> {
  await render(
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={ROUTE_NAMES.CASE_DETAILS}>
          <Stack.Screen
            name={ROUTE_NAMES.CASE_DETAILS}
            component={CaseDetailsScreen}
            initialParams={{ caseId: 'case-1' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const CAPTURED_PHOTO: SerializedCapturedPhotoEvidence = {
  filePath: '/data/user/0/com.fullscan/files/case-1/house-photo-1.jpg',
  latitude: 17.4461,
  longitude: 78.3821,
  accuracyMeters: 6,
  isMockLocation: false,
  capturedAtIso: '2026-09-04T09:05:00.000Z',
  documentTypeCode: 'house_photo_1',
};

/** Stand-in for the case list, so Case Details has somewhere to go back to. */
function PreviousScreen(): React.ReactElement {
  return <Text>Case List</Text>;
}

/**
 * Renders Case Details pushed on top of another screen, which is what the back
 * button (and the unsaved-changes guard) needs to act on.
 */
async function renderCaseDetailsOverPreviousScreen(
  capturedPhotos?: readonly SerializedCapturedPhotoEvidence[],
): Promise<void> {
  await render(
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={ROUTE_NAMES.MAIN}>
          <Stack.Screen name={ROUTE_NAMES.MAIN} component={PreviousScreen} />
          <Stack.Screen name={ROUTE_NAMES.CASE_DETAILS} component={CaseDetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  await act(async () => {
    navigationRef.navigate(
      ROUTE_NAMES.CASE_DETAILS,
      capturedPhotos ? { caseId: 'case-1', capturedPhotos } : { caseId: 'case-1' },
    );
  });
}

describe('CaseDetailsScreen geo-fence gating', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());
    jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());
    useReferenceDataStore.setState({ referenceData: REFERENCE_DATA });
    useGeoFenceBypassStore.getState().clearConsents();
    useLocationStore.setState({
      status: 'ready',
      location: DEVICE_LOCATION,
      errorReason: null,
      isEvaluating: false,
      evaluate: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    useLocationStore.getState().reset();
  });

  it('reveals every section once the device is inside the geo-fence', async () => {
    seedGeoFenceSettings(200);

    await renderCaseDetails();

    await waitFor(() => expect(screen.getByTestId('case-details-gps-banner')).toBeTruthy());
    expect(screen.getByText('Case Information')).toBeTruthy();
    expect(screen.getByText('Masked Phone Actions')).toBeTruthy();
    expect(screen.getByText('Select Verification Status Outcome')).toBeTruthy();
    expect(screen.getByText('Photo Evidence Capture (Camera Only)')).toBeTruthy();
    expect(screen.getByTestId('case-details-submit-button')).toBeTruthy();
    expect(screen.getByTestId('case-details-call-primary')).not.toBeDisabled();
    expect(screen.getByTestId('case-details-call-secondary')).not.toBeDisabled();
    // The row labels already say Primary/Secondary, so both buttons just read "Call" —
    // screen readers still get the distinguishing labels.
    expect(screen.getAllByText('Call')).toHaveLength(2);
    expect(screen.getByLabelText('Call Primary')).toBeTruthy();
    expect(screen.getByLabelText('Call Secondary')).toBeTruthy();
  });

  it('makes a completed case view-only with calling disabled', async () => {
    // A radius the device is outside of: completed cases aren't geo-fenced, so it must not lock them.
    seedGeoFenceSettings(50);
    jest
      .mocked(caseRepository.fetchCaseDetail)
      .mockResolvedValue(buildCaseDetail({ bucket: 'completed' }));

    await renderCaseDetails();

    await waitFor(() => expect(screen.getByTestId('case-details-read-only-notice')).toBeTruthy());
    expect(screen.getByText('Masked Phone Actions')).toBeTruthy();
    expect(screen.getByTestId('case-details-call-primary')).toBeDisabled();
    expect(screen.getByTestId('case-details-call-secondary')).toBeDisabled();
    expect(screen.getByTestId('case-details-open-camera-button')).toBeDisabled();
    expect(screen.queryByTestId('case-details-submit-button')).toBeNull();
    expect(screen.queryByTestId('case-details-save-draft-button')).toBeNull();

    await fireEvent.press(screen.getByTestId('case-details-call-primary'));
    await fireEvent.press(screen.getByTestId('case-details-call-secondary'));
    expect(screen.queryByTestId('case-details-notice')).toBeNull();
  });

  it('shows only Case Information and Case Location while outside the geo-fence', async () => {
    seedGeoFenceSettings(50);

    await renderCaseDetails();

    await waitFor(() => expect(screen.getByTestId('case-details-recalculate-button')).toBeTruthy());
    expect(screen.getByText('Case Information')).toBeTruthy();
    expect(screen.getByText('Location Address')).toBeTruthy();
    expect(screen.queryByText('Masked Phone Actions')).toBeNull();
    expect(screen.queryByText('Select Verification Status Outcome')).toBeNull();
    expect(screen.queryByText('Photo Evidence Capture (Camera Only)')).toBeNull();
    expect(screen.queryByTestId('case-details-submit-button')).toBeNull();
  });

  it('keeps the sections hidden until the Force Proceed consent is actually given', async () => {
    seedGeoFenceSettings(50);
    await renderCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-details-recalculate-button')).toBeTruthy());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await fireEvent.press(screen.getByTestId('case-details-recalculate-button'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('case-details-force-proceed-button')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('case-details-force-proceed-button'));

    // The dialog is up but nothing is unlocked yet.
    expect(
      screen.getByText(
        'This case will be scrutinized after submission because the geo-fence requirement was not met.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Select Verification Status Outcome')).toBeNull();

    await fireEvent.press(screen.getByTestId('case-force-proceed-cancel-button'));
    expect(screen.queryByText('Select Verification Status Outcome')).toBeNull();
  });

  it('reveals the sections after the user agrees to proceed without distance', async () => {
    seedGeoFenceSettings(50);
    await renderCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-details-recalculate-button')).toBeTruthy());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await fireEvent.press(screen.getByTestId('case-details-recalculate-button'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('case-details-force-proceed-button')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('case-details-force-proceed-button'));
    await fireEvent.press(screen.getByTestId('case-force-proceed-agree-button'));

    await waitFor(() =>
      expect(screen.getByText('Select Verification Status Outcome')).toBeTruthy(),
    );
    expect(screen.getByTestId('case-details-geo-fence-bypass-notice')).toBeTruthy();
  });

  it('sends the visit location and measured distance on a normal submission', async () => {
    seedGeoFenceSettings(200);
    await renderCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() => expect(caseRepository.submitVerificationOutcome).toHaveBeenCalled());
    const [, outcome] = jest.mocked(caseRepository.submitVerificationOutcome).mock.calls[0] ?? [];
    expect(outcome).toMatchObject({
      currentLatitude: DEVICE_LOCATION.latitude,
      currentLongitude: DEVICE_LOCATION.longitude,
      forceProceed: false,
    });
    // ~100m between the seeded device fix and the case coordinates.
    expect(outcome?.distanceToCaseMeters).toBeGreaterThan(95);
    expect(outcome?.distanceToCaseMeters).toBeLessThan(105);
  });

  it('sends the visit location for a force-proceeded submission too', async () => {
    seedGeoFenceSettings(50);
    await renderCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-details-recalculate-button')).toBeTruthy());
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await fireEvent.press(screen.getByTestId('case-details-recalculate-button'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('case-details-force-proceed-button')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('case-details-force-proceed-button'));
    await fireEvent.press(screen.getByTestId('case-force-proceed-agree-button'));
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() =>
      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({
          currentLatitude: DEVICE_LOCATION.latitude,
          currentLongitude: DEVICE_LOCATION.longitude,
          forceProceed: true,
        }),
      ),
    );
  });

  it('flags the submission as forceProceed so the back office can scrutinize the case', async () => {
    seedGeoFenceSettings(50);
    await renderCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-details-recalculate-button')).toBeTruthy());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await fireEvent.press(screen.getByTestId('case-details-recalculate-button'));
    }
    await waitFor(() =>
      expect(screen.getByTestId('case-details-force-proceed-button')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('case-details-force-proceed-button'));
    await fireEvent.press(screen.getByTestId('case-force-proceed-agree-button'));
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() =>
      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({ forceProceed: true }),
      ),
    );
  });

  it('leaves forceProceed false for a normal, inside-the-fence submission', async () => {
    seedGeoFenceSettings(200);
    await renderCaseDetails();
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() =>
      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({ forceProceed: false }),
      ),
    );
  });

  it('geocodes an address-only case and gates on the resolved location', async () => {
    seedGeoFenceSettings(200);
    jest
      .mocked(caseRepository.fetchCaseDetail)
      .mockResolvedValue(buildCaseDetail({ coordinates: null }));
    jest.mocked(GeocodingService.resolveAddressCoordinates).mockResolvedValue({
      coordinates: CASE_COORDINATES,
      source: 'provider',
      formattedAddress: null,
      resolvedAtIso: '2026-09-04T09:00:00.000Z',
      providerName: 'google',
    });

    await renderCaseDetails();

    await waitFor(() => expect(screen.getByTestId('case-details-gps-banner')).toBeTruthy());
    expect(GeocodingService.resolveAddressCoordinates).toHaveBeenCalledWith(
      'Flat 204, Madhapur, Hyderabad',
      expect.objectContaining({ providerName: 'google' }),
    );
    expect(screen.getByText('Select Verification Status Outcome')).toBeTruthy();
  });

  it('tells the user to reconnect when an address-only case cannot be resolved offline', async () => {
    seedGeoFenceSettings(200);
    jest
      .mocked(caseRepository.fetchCaseDetail)
      .mockResolvedValue(buildCaseDetail({ coordinates: null }));
    jest
      .mocked(GeocodingService.resolveAddressCoordinates)
      .mockRejectedValue(new GeocodingFailedError('offline', 'offline'));

    await renderCaseDetails();

    await waitFor(() =>
      expect(
        screen.getByText(
          'Case location could not be determined. Connect to the internet and try again.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('Select Verification Status Outcome')).toBeNull();
  });

  it('keeps the case locked when the device location is not usable', async () => {
    seedGeoFenceSettings(200);
    useLocationStore.setState({ status: 'mock_detected', location: null });

    await renderCaseDetails();

    await waitFor(() =>
      expect(screen.getByTestId('case-details-geo-fence-awaiting-location')).toBeTruthy(),
    );
    expect(screen.queryByText('Select Verification Status Outcome')).toBeNull();
    // No Force Proceed escape hatch for a device problem — that must be fixed.
    expect(screen.queryByTestId('case-details-force-proceed-button')).toBeNull();
  });

  it('locks the case when the server geo-fence configuration is unavailable', async () => {
    useReferenceDataStore.setState({ referenceData: null });

    await renderCaseDetails();

    await waitFor(() =>
      expect(screen.getByTestId('case-details-geo-fence-configuration-error')).toBeTruthy(),
    );
    expect(screen.queryByText('Select Verification Status Outcome')).toBeNull();
    expect(screen.queryByTestId('case-details-force-proceed-button')).toBeNull();
  });

  it('still lets a new case be accepted without being at the address', async () => {
    seedGeoFenceSettings(50);
    jest
      .mocked(caseRepository.fetchCaseDetail)
      .mockResolvedValue(buildCaseDetail({ bucket: 'new' }));

    await renderCaseDetails();

    await waitFor(() => expect(screen.getByTestId('case-details-accept-button')).toBeTruthy());
    expect(screen.queryByText('Masked Phone Actions')).toBeNull();
  });
});

describe('CaseDetailsScreen unsaved-changes back guard', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());
    jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());
    seedGeoFenceSettings(200);
    useGeoFenceBypassStore.getState().clearConsents();
    useLocationStore.setState({
      status: 'ready',
      location: DEVICE_LOCATION,
      errorReason: null,
      isEvaluating: false,
      evaluate: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    useLocationStore.getState().reset();
    DraftStorageService.deleteDraft('case-1');
  });

  it('goes back without asking when nothing has been entered', async () => {
    await renderCaseDetailsOverPreviousScreen();
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await act(async () => {
      navigationRef.goBack();
    });

    expect(screen.queryByTestId('case-unsaved-changes-dialog')).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('case-details-submit-button')).toBeNull());
  });

  it('asks for confirmation and stays on the case when answers are unsaved', async () => {
    await renderCaseDetailsOverPreviousScreen();
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.changeText(
      screen.getByTestId('case-details-respondent-name-input'),
      'Anita Sharma',
    );
    await act(async () => {
      navigationRef.goBack();
    });

    await waitFor(() => expect(screen.getByTestId('case-unsaved-changes-dialog')).toBeTruthy());
    expect(screen.getByTestId('case-details-submit-button')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('case-unsaved-changes-keep-editing-button'));

    await waitFor(() => expect(screen.queryByTestId('case-unsaved-changes-dialog')).toBeNull());
    expect(screen.getByTestId('case-details-submit-button')).toBeTruthy();
  });

  it('leaves the case once the field executive confirms the discard', async () => {
    await renderCaseDetailsOverPreviousScreen();
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.changeText(
      screen.getByTestId('case-details-respondent-name-input'),
      'Anita Sharma',
    );
    await act(async () => {
      navigationRef.goBack();
    });
    await waitFor(() => expect(screen.getByTestId('case-unsaved-changes-dialog')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-unsaved-changes-discard-button'));

    await waitFor(() => expect(screen.queryByTestId('case-details-submit-button')).toBeNull());
  });

  it('stops asking once the answers are saved as a draft', async () => {
    await renderCaseDetailsOverPreviousScreen();
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.changeText(
      screen.getByTestId('case-details-respondent-name-input'),
      'Anita Sharma',
    );
    await fireEvent.press(screen.getByTestId('case-details-save-draft-button'));
    await act(async () => {
      navigationRef.goBack();
    });

    expect(screen.queryByTestId('case-unsaved-changes-dialog')).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('case-details-submit-button')).toBeNull());
  });

  it('saves the answers as a draft and leaves when asked to', async () => {
    await renderCaseDetailsOverPreviousScreen();
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.changeText(
      screen.getByTestId('case-details-respondent-name-input'),
      'Anita Sharma',
    );
    await act(async () => {
      navigationRef.goBack();
    });
    await waitFor(() => expect(screen.getByTestId('case-unsaved-changes-dialog')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-unsaved-changes-save-draft-button'));

    await waitFor(() => expect(screen.queryByTestId('case-details-submit-button')).toBeNull());
    expect(DraftStorageService.loadDraft('case-1')?.respondentName).toBe('Anita Sharma');
  });

  it('brings a draft\u2019s captured photos back on to the screen', async () => {
    DraftStorageService.saveDraft({
      caseId: 'case-1',
      verificationStatus: 'verified_clear',
      utvReason: '',
      utvRemarks: '',
      insufficientReason: '',
      insufficientRemarks: '',
      residenceType: 'rented',
      addressType: 'present',
      respondentName: 'Anita Sharma',
      respondentRelation: 'Mother',
      isSignatureCaptured: false,
      selectedPhotoTag: 'house_photo_1',
      capturedPhotos: [CAPTURED_PHOTO],
      geoFenceBypassConsent: null,
      savedAt: '2026-09-10T10:00:00.000Z',
    });

    await renderCaseDetailsOverPreviousScreen();

    await waitFor(() =>
      expect(screen.getByTestId(`case-photo-thumbnail-${CAPTURED_PHOTO.filePath}`)).toBeTruthy(),
    );
    // Restored, not re-entered — leaving must not prompt.
    await act(async () => {
      navigationRef.goBack();
    });
    expect(screen.queryByTestId('case-unsaved-changes-dialog')).toBeNull();
  });

  it('treats a captured photo as unsaved work', async () => {
    await renderCaseDetailsOverPreviousScreen([CAPTURED_PHOTO]);
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await act(async () => {
      navigationRef.goBack();
    });

    await waitFor(() => expect(screen.getByTestId('case-unsaved-changes-dialog')).toBeTruthy());
  });

  it('keeps captured photos in the draft, so saving stops the prompt', async () => {
    await renderCaseDetailsOverPreviousScreen([CAPTURED_PHOTO]);
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-save-draft-button'));
    await act(async () => {
      navigationRef.goBack();
    });

    expect(screen.queryByTestId('case-unsaved-changes-dialog')).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('case-details-submit-button')).toBeNull());
    expect(DraftStorageService.loadDraft('case-1')?.capturedPhotos).toHaveLength(1);
  });
});

describe('CaseDetailsScreen evidence upload on submit', () => {
  const UPLOADED_EVIDENCE: UploadedCaseEvidence = {
    id: 'evidence-1',
    caseId: 'case-1',
    fileName: 'house_photo_1-1788512700000.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 482113,
    sha256: 'sha-evidence-1',
    documentTypeCode: 'house_photo_1',
    latitude: CAPTURED_PHOTO.latitude,
    longitude: CAPTURED_PHOTO.longitude,
    accuracyMeters: CAPTURED_PHOTO.accuracyMeters,
    isMockLocation: false,
    capturedAt: new Date('2026-09-04T09:05:00.000Z'),
    uploadedAt: new Date('2026-09-04T09:10:00.000Z'),
    wasAlreadyUploaded: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await LocalizationEngine.initialize();
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());
    jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());
    jest.mocked(caseEvidenceRepository.uploadCaseEvidence).mockResolvedValue(UPLOADED_EVIDENCE);
    seedGeoFenceSettings(200);
    useGeoFenceBypassStore.getState().clearConsents();
    useLocationStore.setState({
      status: 'ready',
      location: DEVICE_LOCATION,
      errorReason: null,
      isEvaluating: false,
      evaluate: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    LocalizationEngine.dispose();
    useLocationStore.getState().reset();
    DraftStorageService.deleteDraft('case-1');
    EvidenceReceiptStorageService.clearReceipts('case-1');
  });

  it('shows upload progress on the submit button, then submits and leaves', async () => {
    let finishUpload: (evidence: UploadedCaseEvidence) => void = () => undefined;
    jest.mocked(caseEvidenceRepository.uploadCaseEvidence).mockReturnValueOnce(
      new Promise<UploadedCaseEvidence>((resolve) => {
        finishUpload = resolve;
      }),
    );
    await renderCaseDetailsOverPreviousScreen([CAPTURED_PHOTO]);
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() => expect(screen.getByText('Uploading photos 0 of 1')).toBeTruthy());
    expect(screen.getByLabelText('Uploading photos 0 of 1')).toBeTruthy();
    expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();

    await act(async () => {
      finishUpload(UPLOADED_EVIDENCE);
    });

    await waitFor(() => expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('case-details-submit-button')).toBeNull());
  });

  it('tells the executive the case is closed to new evidence on a 409, without submitting', async () => {
    jest
      .mocked(caseEvidenceRepository.uploadCaseEvidence)
      .mockRejectedValueOnce(new CaseEvidenceUploadError('caseClosed', 409));
    await renderCaseDetailsOverPreviousScreen([CAPTURED_PHOTO]);
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() => expect(screen.getByTestId('case-details-submit-error')).toBeTruthy());
    expect(
      screen.getByText(
        'This case is closed to new evidence, so your photos could not be uploaded. The verification report was not submitted.',
      ),
    ).toBeTruthy();
    expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
    // Still on the case, with the button back to its normal label.
    expect(screen.getByText('Submit Verification Report')).toBeTruthy();
  });

  it('shows the generic photo-upload message for any other upload failure', async () => {
    jest
      .mocked(caseEvidenceRepository.uploadCaseEvidence)
      .mockRejectedValueOnce(new CaseEvidenceUploadError('network'));
    await renderCaseDetailsOverPreviousScreen([CAPTURED_PHOTO]);
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Your photos could not be uploaded, so the verification report was not submitted. Check your connection and try again.',
        ),
      ).toBeTruthy(),
    );
    expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
  });

  it('keeps the report-submission message for an outcome failure after the photos uploaded', async () => {
    jest.mocked(caseRepository.submitVerificationOutcome).mockRejectedValueOnce(new Error('offline'));
    await renderCaseDetailsOverPreviousScreen([CAPTURED_PHOTO]);
    await waitFor(() => expect(screen.getByTestId('case-details-submit-button')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('case-details-submit-button'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Unable to submit the verification report. Check your connection and try again.',
        ),
      ).toBeTruthy(),
    );
    expect(caseEvidenceRepository.uploadCaseEvidence).toHaveBeenCalledTimes(1);
  });
});
