import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as caseRepository from '@/repositories/case-repository';
import { useReferenceDataStore } from '@/store/reference-data';
import type { Case, CaseDetail } from '@/domain/case';
import type { SerializedCapturedPhotoEvidence } from '@/navigation/routes';
import type { ReferenceData } from '@/domain/reference-data';

import { DraftStorageService } from '../services/draft-storage';
import type { CaseDraft } from '../services/draft-storage';
import { useCaseDetails } from './use-case-details';

jest.mock('@/repositories/case-repository');

/** A case with no evidence captured this session — a stable reference so the hook does not re-render on it. */
const NO_PHOTOS: readonly SerializedCapturedPhotoEvidence[] = [];

const mockReferenceData: ReferenceData = {
  verificationTypeStatuses: [
    { code: 'verified_clear', label: 'Verified Clear' },
    { code: 'utv', label: 'UTV' },
    { code: 'insufficient', label: 'Insufficient' },
  ],
  utvOptions: [
    { code: 'shifted', label: 'Shifted' },
    { code: 'not_joining', label: 'Not Joining' },
  ],
  insuffOptions: [{ code: 'incorrect_address', label: 'Incorrect Address' }],
  photoTypes: [
    { code: 'house_photo_1', label: 'House Photo 1' },
    { code: 'door_number', label: 'Door Number' },
  ],
  componentStatuses: [{ code: 'component_accepted', label: 'Component Accepted' }],
  actionStatuses: [{ code: 'accepted', label: 'Accept/Approve' }],
  profileStatuses: [{ code: 'wip', label: 'WIP' }],
  mobileAppSettings: { values: {}, updatedAt: null },
};

function buildCaseDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'case-1',
    caseId: 'case-parent-1',
    caseRef: 'FS-2026-00001',
    bucket: 'pending',
    tatDueAt: new Date('2026-08-30T00:00:00.000Z'),
    candidateName: 'Rahul Sharma',
    fatherOrSpouseName: 'Suresh Sharma',
    employerName: 'ABC Pvt Ltd',
    verificationType: 'Address',
    clientName: 'ABC Pvt Ltd',
    address: 'Flat 204, Madhapur, Hyderabad',
    addressType: 'present',
    residenceType: 'rented',
    coordinates: { latitude: 17.4452, longitude: 78.3821 },
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

function buildCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case-1',
    caseId: 'case-parent-1',
    caseRef: 'FS-2026-00001',
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'Flat 204, Madhapur, Hyderabad',
    bucket: 'completed',
    updatedAt: new Date('2026-08-26T00:00:00.000Z'),
    ...overrides,
  };
}

describe('useCaseDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useReferenceDataStore.setState({ referenceData: mockReferenceData });
  });

  afterEach(() => {
    useReferenceDataStore.setState({ referenceData: null });
  });

  it('loads the case detail and seeds the outcome form from server defaults', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(
      buildCaseDetail({ selectedVerificationStatus: 'utv', respondent: { name: 'Anita', relation: 'Mother' } }),
    );

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.caseDetail?.caseRef).toBe('FS-2026-00001');
    expect(result.current.verificationStatus).toBe('utv');
    expect(result.current.isUtvSectionVisible).toBe(true);
    expect(result.current.respondentName).toBe('Anita');
  });

  it('defaults the status and photo tag to the first reference-data option when none is set', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.verificationStatus).toBe('verified_clear');
    expect(result.current.selectedPhotoTag).toBe('house_photo_1');
  });

  it('surfaces a network error key when loading fails', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockRejectedValue(new Error('boom'));

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.loadError).toBe('network');
    expect(result.current.caseDetail).toBeNull();
  });

  it('shows the Insufficient section only when that status is selected', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isInsufficientSectionVisible).toBe(false);

    await act(async () => {
      result.current.selectVerificationStatus('insufficient');
    });

    expect(result.current.isInsufficientSectionVisible).toBe(true);
    expect(result.current.isUtvSectionVisible).toBe(false);
  });

  it('shows the Verified Residence section only for Verified Clear inside the geo-fence', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(
      buildCaseDetail({ coordinates: null }),
    );

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.selectVerificationStatus('verified_clear');
    });

    expect(result.current.isVerifiedResidenceSectionVisible).toBe(false);
  });

  it('submits the verification outcome and invokes the callback on success', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());
    jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.selectVerificationStatus('utv');
    });

    const onSubmitted = jest.fn();
    await act(async () => {
      result.current.submit(onSubmitted);
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledWith(
      'case-1',
      expect.objectContaining({ verificationStatus: 'utv' }),
    );
  });

  it('surfaces a network error key when submitting fails', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());
    jest.mocked(caseRepository.submitVerificationOutcome).mockRejectedValue(new Error('boom'));

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const onSubmitted = jest.fn();
    await act(async () => {
      result.current.submit(onSubmitted);
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(onSubmitted).not.toHaveBeenCalled();
    expect(result.current.submitError).toBe('network');
  });

  it('identifies a new bucket case and hides detail form sections', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'new' }));

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(true);
    expect(result.current.shouldShowDetailFormSections).toBe(false);
    expect(result.current.isReadOnly).toBe(false);
  });

  it('marks a pending bucket case as editable with all sections visible', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'pending' }));

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(false);
    expect(result.current.shouldShowDetailFormSections).toBe(true);
    expect(result.current.isReadOnly).toBe(false);
  });

  it('marks a beyondTat bucket case as editable with all sections visible', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'beyondTat' }));

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(false);
    expect(result.current.shouldShowDetailFormSections).toBe(true);
    expect(result.current.isReadOnly).toBe(false);
  });

  it('marks a completed bucket case as read-only with all sections visible', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'completed' }));

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(false);
    expect(result.current.shouldShowDetailFormSections).toBe(true);
    expect(result.current.isReadOnly).toBe(true);
  });

  describe('unsaved changes tracking', () => {
    afterEach(() => {
      DraftStorageService.deleteDraft('case-1');
    });

    it('reports a freshly loaded case as clean', async () => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('reports unsaved changes once an answer is entered', async () => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.setRespondentName('Anita');
      });

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('goes back to clean after the draft is saved', async () => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.selectUtvReason('shifted');
      });
      expect(result.current.hasUnsavedChanges).toBe(true);

      await act(async () => {
        result.current.saveDraft();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('reports changes again when the form moves away from the saved draft', async () => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.saveDraft();
      });
      await act(async () => {
        result.current.setUtvRemarks('Nobody at the address.');
      });

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('treats a restored draft as the saved state, not as unsaved work', async () => {
      DraftStorageService.saveDraft({
        caseId: 'case-1',
        verificationStatus: 'utv',
        utvReason: 'shifted',
        utvRemarks: 'Family moved out.',
        insufficientReason: '',
        insufficientRemarks: '',
        residenceType: 'rented',
        addressType: 'present',
        respondentName: 'Anita',
        respondentRelation: 'Mother',
        isSignatureCaptured: false,
        selectedPhotoTag: 'door_number',
        capturedPhotos: [],
        geoFenceBypassConsent: null,
        savedAt: '2026-09-10T10:00:00.000Z',
      });
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.hasDraft).toBe(true));

      expect(result.current.utvRemarks).toBe('Family moved out.');
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('never reports unsaved changes on a read-only case', async () => {
      jest
        .mocked(caseRepository.fetchCaseDetail)
        .mockResolvedValue(buildCaseDetail({ bucket: 'completed' }));

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.setRespondentName('Anita');
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('never reports unsaved changes on a not-yet-accepted case', async () => {
      jest
        .mocked(caseRepository.fetchCaseDetail)
        .mockResolvedValue(buildCaseDetail({ bucket: 'new' }));

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.setRespondentName('Anita');
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });

  describe('completed (view-only) case', () => {
    const leftoverDraft: CaseDraft = {
      caseId: 'case-1',
      verificationStatus: 'utv',
      utvReason: 'shifted',
      utvRemarks: '',
      insufficientReason: '',
      insufficientRemarks: '',
      residenceType: 'rented',
      addressType: 'present',
      respondentName: 'Draft Respondent',
      respondentRelation: '',
      isSignatureCaptured: false,
      selectedPhotoTag: 'door_number',
      capturedPhotos: [],
      geoFenceBypassConsent: null,
      savedAt: '2026-09-10T10:00:00.000Z',
    };

    afterEach(() => {
      DraftStorageService.deleteDraft('case-1');
    });

    it('shows the submitted values, never a leftover local draft', async () => {
      DraftStorageService.saveDraft(leftoverDraft);
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(
        buildCaseDetail({
          bucket: 'completed',
          selectedVerificationStatus: 'verified_clear',
          respondent: { name: 'Anita', relation: 'Mother' },
        }),
      );

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.verificationStatus).toBe('verified_clear');
      expect(result.current.respondentName).toBe('Anita');
      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftSavedAt).toBeNull();
    });

    it('refuses to submit or save a draft', async () => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'completed' }));

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
        result.current.saveDraft();
      });

      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
      expect(onSubmitted).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
      expect(DraftStorageService.loadDraft('case-1')).toBeNull();
      expect(result.current.hasDraft).toBe(false);
    });
  });
});
