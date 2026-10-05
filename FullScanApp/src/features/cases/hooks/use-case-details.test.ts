import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as caseRepository from '@/repositories/case-repository';
import * as caseEvidenceRepository from '@/repositories/case-evidence-repository';
import { CaseEvidenceUploadError } from '@/repositories/case-evidence-repository.errors';
import type { CaseEvidenceUploadFailureReason } from '@/repositories/case-evidence-repository.errors';
import { useReferenceDataStore } from '@/store/reference-data';
import type { Case, CaseDetail, UploadedCaseEvidence } from '@/domain/case';
import type { SerializedCapturedPhotoEvidence } from '@/navigation/routes';
import type { ReferenceData } from '@/domain/reference-data';

import { CaseListCache } from '../services/case-list-cache';
import { DraftStorageService } from '../services/draft-storage';
import type { CaseDraft } from '../services/draft-storage';
import { EvidenceReceiptStorageService } from '../services/evidence-receipt-storage';
import { useCaseDetails } from './use-case-details';

jest.mock('@/repositories/case-repository');
jest.mock('@/repositories/case-evidence-repository');

/** A case with no evidence captured this session — a stable reference so the hook does not re-render on it. */
const NO_PHOTOS: readonly SerializedCapturedPhotoEvidence[] = [];

/** At least one photo is mandatory, so every submission that should go through carries this one. */
const ONE_CAPTURED_PHOTO: readonly SerializedCapturedPhotoEvidence[] = [
  {
    filePath: '/data/user/0/com.fullscan/cache/visit-photo.jpg',
    latitude: 17.4461,
    longitude: 78.3821,
    accuracyMeters: 6,
    isMockLocation: false,
    capturedAtIso: '2026-10-04T09:15:02.123Z',
    documentTypeCode: 'house_photo_1',
  },
];

function buildUploadedEvidenceFor(photo: { readonly documentTypeCode: string }): UploadedCaseEvidence {
  return {
    id: `evidence-${photo.documentTypeCode}`,
    caseId: 'case-1',
    fileName: `${photo.documentTypeCode}-1791105302123.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 482113,
    sha256: `sha-${photo.documentTypeCode}`,
    documentTypeCode: photo.documentTypeCode,
    latitude: 17.4461,
    longitude: 78.3821,
    accuracyMeters: 6,
    isMockLocation: false,
    capturedAt: new Date('2026-10-04T09:15:02.000Z'),
    uploadedAt: new Date('2026-10-04T09:20:11.000Z'),
    wasAlreadyUploaded: false,
  };
}

const mockReferenceData: ReferenceData = {
  updatedAt: null,
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
    checkId: 'case-1',
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
    checkId: 'case-1',
    caseRef: 'FS-2026-00001',
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'Flat 204, Madhapur, Hyderabad',
    updatedAt: new Date('2026-08-26T00:00:00.000Z'),
    ...overrides,
  };
}

describe('useCaseDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useReferenceDataStore.setState({ referenceData: mockReferenceData });
    jest
      .mocked(caseEvidenceRepository.uploadCaseEvidence)
      .mockImplementation(async (_caseId, photo) => buildUploadedEvidenceFor(photo));
  });

  afterEach(() => {
    useReferenceDataStore.setState({ referenceData: null });
    // A failed outcome keeps its upload receipts; none may leak into the next test.
    EvidenceReceiptStorageService.clearReceipts('case-1');
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

  it('preselects no outcome answer, but defaults the photo tag to the first reference-data option', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

    const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.verificationStatus).toBe('');
    expect(result.current.residenceType).toBeNull();
    expect(result.current.addressType).toBeNull();
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

    const { result } = await renderHook(() => useCaseDetails('case-1', ONE_CAPTURED_PHOTO));
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
    jest
      .mocked(caseRepository.fetchCaseDetail)
      .mockResolvedValue(buildCaseDetail({ selectedVerificationStatus: 'utv' }));
    jest.mocked(caseRepository.submitVerificationOutcome).mockRejectedValue(new Error('boom'));

    const { result } = await renderHook(() => useCaseDetails('case-1', ONE_CAPTURED_PHOTO));
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

  describe('submission validation', () => {
    const HOUSE_PHOTO: SerializedCapturedPhotoEvidence = {
      filePath: '/data/user/0/com.fullscan/cache/house-photo.jpg',
      latitude: 17.4461,
      longitude: 78.3821,
      accuracyMeters: 6,
      isMockLocation: false,
      capturedAtIso: '2026-10-04T09:15:02.123Z',
      documentTypeCode: 'house_photo_1',
    };
    /** A stable reference so the hook does not re-render on it. */
    const ONE_PHOTO: readonly SerializedCapturedPhotoEvidence[] = [HOUSE_PHOTO];

    async function renderLoadedCase(photos: readonly SerializedCapturedPhotoEvidence[] = NO_PHOTOS) {
      const rendered = await renderHook(() => useCaseDetails('case-1', photos));
      await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
      return rendered;
    }

    beforeEach(() => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());
      jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());
    });

    afterEach(() => {
      EvidenceReceiptStorageService.clearReceipts('case-1');
    });

    it('flags nothing before Submit is pressed', async () => {
      const { result } = await renderLoadedCase();

      expect(result.current.fieldErrorKeys).toEqual({});
      expect(result.current.validationSummaryKey).toBeNull();
    });

    it('refuses to submit when nothing has been entered', async () => {
      const { result } = await renderLoadedCase();

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });

      expect(result.current.validationSummaryKey).toBe('caseDetails.validation.nothingEntered');
      expect(result.current.fieldErrorKeys).toEqual({
        verificationStatus: 'validation.required',
        capturedPhotoCount: 'caseDetails.validation.photoRequired',
      });
      expect(result.current.isSubmitting).toBe(false);
      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
      expect(onSubmitted).not.toHaveBeenCalled();
    });

    it('refuses to submit photos alone, without uploading them', async () => {
      const { result } = await renderLoadedCase(ONE_PHOTO);

      await act(async () => {
        result.current.submit(jest.fn());
      });

      expect(result.current.validationSummaryKey).toBe('caseDetails.validation.photosOnly');
      expect(caseEvidenceRepository.uploadCaseEvidence).not.toHaveBeenCalled();
      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
    });

    it('requires every Verified Residence & Respondent field for Verified Clear, before any upload', async () => {
      const { result } = await renderLoadedCase(ONE_PHOTO);

      await act(async () => {
        result.current.selectVerificationStatus('verified_clear');
      });
      await act(async () => {
        result.current.submit(jest.fn());
      });

      expect(result.current.validationSummaryKey).toBe('caseDetails.validation.incomplete');
      expect(result.current.fieldErrorKeys).toEqual({
        residenceType: 'validation.required',
        addressType: 'validation.required',
        respondentName: 'validation.required',
        respondentRelation: 'validation.required',
        isSignatureCaptured: 'validation.required',
      });
      expect(caseEvidenceRepository.uploadCaseEvidence).not.toHaveBeenCalled();
      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
    });

    it('clears each error as it is fixed, once Submit has been pressed', async () => {
      const { result } = await renderLoadedCase();

      await act(async () => {
        result.current.selectVerificationStatus('verified_clear');
      });
      await act(async () => {
        result.current.submit(jest.fn());
      });
      await act(async () => {
        result.current.selectResidenceType('owned');
        result.current.setRespondentName('Anita');
      });

      expect(result.current.fieldErrorKeys).toEqual({
        capturedPhotoCount: 'caseDetails.validation.photoRequired',
        addressType: 'validation.required',
        respondentRelation: 'validation.required',
        isSignatureCaptured: 'validation.required',
      });
    });

    it('refuses an otherwise complete outcome with no photo', async () => {
      const { result } = await renderLoadedCase();

      await act(async () => {
        result.current.selectVerificationStatus('utv');
      });
      await act(async () => {
        result.current.submit(jest.fn());
      });

      expect(result.current.validationSummaryKey).toBe('caseDetails.validation.incomplete');
      expect(result.current.fieldErrorKeys).toEqual({
        capturedPhotoCount: 'caseDetails.validation.photoRequired',
      });
      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
    });

    it('marks the photo as required from the start', async () => {
      const { result } = await renderLoadedCase();

      expect(result.current.requiredFields).toEqual({
        verificationStatus: true,
        capturedPhotoCount: true,
      });
    });

    it('submits a fully completed Verified Clear outcome', async () => {
      const { result } = await renderLoadedCase(ONE_PHOTO);

      await act(async () => {
        result.current.selectVerificationStatus('verified_clear');
      });
      await act(async () => {
        result.current.selectResidenceType('owned');
        result.current.selectAddressType('permanent');
        result.current.setRespondentName('Anita');
        result.current.setRespondentRelation('Mother');
        result.current.markSignatureCaptured();
      });

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      expect(result.current.validationSummaryKey).toBeNull();
      expect(caseEvidenceRepository.uploadCaseEvidence).toHaveBeenCalledTimes(1);
      // The residence payload itself is geo-fence gated — the screen test covers it end to end.
      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({ verificationStatus: 'verified_clear', isSignatureCaptured: true }),
      );
    });

    it('does not require the Verified Residence fields for another status', async () => {
      const { result } = await renderLoadedCase(ONE_PHOTO);

      await act(async () => {
        result.current.selectVerificationStatus('insufficient');
      });
      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({ verificationStatus: 'insufficient', respondent: null }),
      );
    });
  });

  describe('case-list cache updates', () => {
    /** Puts a loaded tab and the counts into the case-list cache, as the list would have. */
    function seedCaseListCache(): void {
      const { tabGenerations } = CaseListCache.getSnapshot();
      CaseListCache.storeFirstPage('new', tabGenerations.new, {
        items: [buildCase({ id: 'case-1' }), buildCase({ id: 'case-2' })],
        nextCursor: null,
      });
      CaseListCache.storeFirstPage('pending', tabGenerations.pending, {
        items: [buildCase({ id: 'case-3' })],
        nextCursor: 'pending-cursor',
      });
      CaseListCache.storeFirstPage('beyondTat', tabGenerations.beyondTat, {
        items: [buildCase({ id: 'case-1' }), buildCase({ id: 'case-4' })],
        nextCursor: 'tat-cursor',
      });
      CaseListCache.storeFirstPage('completed', tabGenerations.completed, {
        items: [buildCase({ id: 'case-5' })],
        nextCursor: null,
      });
      CaseListCache.storeCounts(CaseListCache.supersedeCountsRequests(), {
        new: 2,
        pending: 10,
        beyondTat: 7,
        completed: 4,
      });
    }

    function readTabIds(bucket: 'new' | 'pending' | 'beyondTat' | 'completed'): string[] | null {
      return CaseListCache.getSnapshot().tabs[bucket]?.items.map((item) => item.id) ?? null;
    }

    beforeEach(() => {
      CaseListCache.clear();
      seedCaseListCache();
    });

    afterEach(() => {
      CaseListCache.clear();
      DraftStorageService.deleteDraft('case-1');
    });

    it('moves an accepted case from New towards Pending in the list cache', async () => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'new' }));
      jest.mocked(caseRepository.acceptCase).mockResolvedValue(buildCase());

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const onAccepted = jest.fn();
      await act(async () => {
        result.current.acceptCase(onAccepted);
      });
      await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));

      expect(readTabIds('new')).toEqual(['case-2']);
      // Discarded: the accepted case now heads Pending's first page.
      expect(readTabIds('pending')).toBeNull();
      expect(readTabIds('beyondTat')).toEqual(['case-1', 'case-4']);
      expect(CaseListCache.getSnapshot().counts).toEqual({
        new: 1,
        pending: 11,
        beyondTat: 7,
        completed: 4,
      });
    });

    it('leaves the list cache alone when accepting fails', async () => {
      jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'new' }));
      jest.mocked(caseRepository.acceptCase).mockRejectedValue(new Error('offline'));

      const { result } = await renderHook(() => useCaseDetails('case-1', NO_PHOTOS));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const onAccepted = jest.fn();
      await act(async () => {
        result.current.acceptCase(onAccepted);
      });
      await waitFor(() => expect(result.current.submitError).toBe('network'));

      expect(onAccepted).not.toHaveBeenCalled();
      expect(readTabIds('new')).toEqual(['case-1', 'case-2']);
      expect(readTabIds('pending')).toEqual(['case-3']);
      expect(CaseListCache.getSnapshot().counts?.new).toBe(2);
    });

    it('moves a submitted case out of its own tab and discards Completed', async () => {
      jest
        .mocked(caseRepository.fetchCaseDetail)
        .mockResolvedValue(buildCaseDetail({ bucket: 'beyondTat', selectedVerificationStatus: 'utv' }));
      jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());

      const { result } = await renderHook(() => useCaseDetails('case-1', ONE_CAPTURED_PHOTO));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      expect(readTabIds('beyondTat')).toEqual(['case-4']);
      // The rest of the tab's paging is untouched.
      expect(CaseListCache.getSnapshot().tabs.beyondTat?.nextCursor).toBe('tat-cursor');
      expect(readTabIds('completed')).toBeNull();
      expect(readTabIds('new')).toEqual(['case-1', 'case-2']);
      expect(readTabIds('pending')).toEqual(['case-3']);
      expect(CaseListCache.getSnapshot().counts).toEqual({
        new: 2,
        pending: 10,
        beyondTat: 6,
        completed: 5,
      });
    });

    it('leaves the list cache alone when submitting fails', async () => {
      jest
        .mocked(caseRepository.fetchCaseDetail)
        .mockResolvedValue(buildCaseDetail({ bucket: 'pending', selectedVerificationStatus: 'utv' }));
      jest.mocked(caseRepository.submitVerificationOutcome).mockRejectedValue(new Error('offline'));

      const { result } = await renderHook(() => useCaseDetails('case-1', ONE_CAPTURED_PHOTO));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.submit(jest.fn());
      });
      await waitFor(() => expect(result.current.submitError).toBe('network'));

      expect(readTabIds('pending')).toEqual(['case-3']);
      expect(readTabIds('completed')).toEqual(['case-5']);
      expect(CaseListCache.getSnapshot().counts?.completed).toBe(4);
    });
  });

  describe('evidence upload on submit', () => {
    const HOUSE_PHOTO: SerializedCapturedPhotoEvidence = {
      filePath: '/data/user/0/com.fullscan/cache/house-photo.jpg',
      latitude: 17.4461,
      longitude: 78.3821,
      accuracyMeters: 6,
      isMockLocation: false,
      capturedAtIso: '2026-10-04T09:15:02.123Z',
      documentTypeCode: 'house_photo_1',
    };
    const DOOR_PHOTO: SerializedCapturedPhotoEvidence = {
      filePath: '/data/user/0/com.fullscan/cache/door-number.jpg',
      latitude: 17.4462,
      longitude: 78.3822,
      accuracyMeters: 7,
      isMockLocation: false,
      capturedAtIso: '2026-10-04T09:16:40.000Z',
      documentTypeCode: 'door_number',
    };
    /** Capture order: house first. A stable reference so the hook does not re-render on it. */
    const TWO_PHOTOS: readonly SerializedCapturedPhotoEvidence[] = [HOUSE_PHOTO, DOOR_PHOTO];

    function buildUploadedEvidence(id: string, documentTypeCode: string): UploadedCaseEvidence {
      return {
        id,
        caseId: 'case-1',
        fileName: `${documentTypeCode}-1791105302123.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 482113,
        sha256: `sha-${id}`,
        documentTypeCode,
        latitude: 17.4461,
        longitude: 78.3821,
        accuracyMeters: 6,
        isMockLocation: false,
        capturedAt: new Date('2026-10-04T09:15:02.000Z'),
        uploadedAt: new Date('2026-10-04T09:20:11.000Z'),
        wasAlreadyUploaded: false,
      };
    }

    function createDeferred<TValue>(): {
      readonly promise: Promise<TValue>;
      readonly resolve: (value: TValue) => void;
    } {
      let resolvePromise: (value: TValue) => void = () => undefined;
      const promise = new Promise<TValue>((resolve) => {
        resolvePromise = resolve;
      });
      return { promise, resolve: (value) => resolvePromise(value) };
    }

    function uploadedDocumentTypeCodes(): string[] {
      return jest
        .mocked(caseEvidenceRepository.uploadCaseEvidence)
        .mock.calls.map(([, photo]) => photo.documentTypeCode);
    }

    async function renderLoadedCase(photos: readonly SerializedCapturedPhotoEvidence[]) {
      const rendered = await renderHook(() => useCaseDetails('case-1', photos));
      await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
      return rendered;
    }

    beforeEach(() => {
      // A complete outcome, so these tests exercise the upload rather than validation.
      jest
        .mocked(caseRepository.fetchCaseDetail)
        .mockResolvedValue(buildCaseDetail({ selectedVerificationStatus: 'utv' }));
      jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());
      jest
        .mocked(caseEvidenceRepository.uploadCaseEvidence)
        .mockImplementation(async (_caseId, photo) =>
          buildUploadedEvidence(`evidence-${photo.documentTypeCode}`, photo.documentTypeCode),
        );
    });

    afterEach(() => {
      EvidenceReceiptStorageService.clearReceipts('case-1');
      DraftStorageService.deleteDraft('case-1');
    });

    it('uploads every captured photo, in capture order, before sending the outcome', async () => {
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      const uploadMock = jest.mocked(caseEvidenceRepository.uploadCaseEvidence).mock;
      expect(uploadMock.calls.map(([caseId]) => caseId)).toEqual(['case-1', 'case-1']);
      expect(uploadedDocumentTypeCodes()).toEqual(['house_photo_1', 'door_number']);
      // The repository gets the domain shape, capture time rehydrated as a Date.
      expect(uploadMock.calls[0]?.[1]).toEqual({
        filePath: HOUSE_PHOTO.filePath,
        latitude: HOUSE_PHOTO.latitude,
        longitude: HOUSE_PHOTO.longitude,
        accuracyMeters: HOUSE_PHOTO.accuracyMeters,
        isMockLocation: false,
        capturedAt: new Date(HOUSE_PHOTO.capturedAtIso),
        documentTypeCode: 'house_photo_1',
      });
      const [outcomeCallOrder] = jest.mocked(caseRepository.submitVerificationOutcome).mock
        .invocationCallOrder;
      expect(outcomeCallOrder).toBeGreaterThan(Math.max(...uploadMock.invocationCallOrder));
    });

    it('skips photos that already have an upload receipt', async () => {
      EvidenceReceiptStorageService.markUploaded('case-1', HOUSE_PHOTO.filePath, 'evidence-earlier');
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      expect(uploadedDocumentTypeCodes()).toEqual(['door_number']);
      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledTimes(1);
    });

    it('neither uploads nor sends the outcome when no photo was captured', async () => {
      const { result } = await renderLoadedCase(NO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });

      expect(result.current.fieldErrorKeys.capturedPhotoCount).toBe(
        'caseDetails.validation.photoRequired',
      );
      expect(caseEvidenceRepository.uploadCaseEvidence).not.toHaveBeenCalled();
      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
      expect(result.current.evidenceUploadProgress).toBeNull();
    });

    it('exposes upload progress while photos upload, and clears it before the outcome', async () => {
      const firstUpload = createDeferred<UploadedCaseEvidence>();
      const secondUpload = createDeferred<UploadedCaseEvidence>();
      jest
        .mocked(caseEvidenceRepository.uploadCaseEvidence)
        .mockReturnValueOnce(firstUpload.promise)
        .mockReturnValueOnce(secondUpload.promise);
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() =>
        expect(result.current.evidenceUploadProgress).toEqual({ uploadedCount: 0, totalCount: 2 }),
      );
      expect(result.current.isSubmitting).toBe(true);

      await act(async () => {
        firstUpload.resolve(buildUploadedEvidence('evidence-1', 'house_photo_1'));
      });
      await waitFor(() =>
        expect(result.current.evidenceUploadProgress).toEqual({ uploadedCount: 1, totalCount: 2 }),
      );
      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();

      await act(async () => {
        secondUpload.resolve(buildUploadedEvidence('evidence-2', 'door_number'));
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
      expect(result.current.evidenceUploadProgress).toBeNull();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('clears the case’s upload receipts once the outcome is accepted', async () => {
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({});
    });

    it('keeps the receipts when the outcome fails, so the retry re-sends only the outcome', async () => {
      jest
        .mocked(caseRepository.submitVerificationOutcome)
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(buildCase());
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(result.current.submitError).toBe('network'));

      expect(onSubmitted).not.toHaveBeenCalled();
      expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({
        [HOUSE_PHOTO.filePath]: 'evidence-house_photo_1',
        [DOOR_PHOTO.filePath]: 'evidence-door_number',
      });

      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      expect(caseEvidenceRepository.uploadCaseEvidence).toHaveBeenCalledTimes(2);
      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledTimes(2);
      expect(result.current.submitError).toBeNull();
    });

    it('stops before the outcome and reports evidenceCaseClosed when the server answers 409', async () => {
      jest
        .mocked(caseEvidenceRepository.uploadCaseEvidence)
        .mockRejectedValueOnce(new CaseEvidenceUploadError('caseClosed', 409));
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(result.current.submitError).toBe('evidenceCaseClosed'));

      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
      expect(onSubmitted).not.toHaveBeenCalled();
      expect(uploadedDocumentTypeCodes()).toEqual(['house_photo_1']);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.evidenceUploadProgress).toBeNull();
    });

    it.each<[CaseEvidenceUploadFailureReason, number | null]>([
      ['rejected', 500],
      ['rejected', 404],
      ['network', null],
      ['timeout', null],
      ['invalidResponse', 201],
      ['invalidPhoto', null],
      ['unexpected', null],
    ])(
      'stops before the outcome and reports evidenceUploadFailed for %s (%s)',
      async (reason, status) => {
        jest
          .mocked(caseEvidenceRepository.uploadCaseEvidence)
          .mockRejectedValueOnce(new CaseEvidenceUploadError(reason, status));
        const { result } = await renderLoadedCase(TWO_PHOTOS);

        const onSubmitted = jest.fn();
        await act(async () => {
          result.current.submit(onSubmitted);
        });
        await waitFor(() => expect(result.current.submitError).toBe('evidenceUploadFailed'));

        expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
        expect(onSubmitted).not.toHaveBeenCalled();
      },
    );

    it('reports evidenceUploadFailed for a failure that is not a typed upload error', async () => {
      jest
        .mocked(caseEvidenceRepository.uploadCaseEvidence)
        .mockRejectedValueOnce(new Error('something else'));
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      await act(async () => {
        result.current.submit(jest.fn());
      });
      await waitFor(() => expect(result.current.submitError).toBe('evidenceUploadFailed'));

      expect(caseRepository.submitVerificationOutcome).not.toHaveBeenCalled();
    });

    it('keeps the receipts of photos uploaded before a failure, and the retry resumes after them', async () => {
      jest
        .mocked(caseEvidenceRepository.uploadCaseEvidence)
        .mockResolvedValueOnce(buildUploadedEvidence('evidence-1', 'house_photo_1'))
        .mockRejectedValueOnce(new CaseEvidenceUploadError('network'));
      const { result } = await renderLoadedCase(TWO_PHOTOS);

      const onSubmitted = jest.fn();
      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(result.current.submitError).toBe('evidenceUploadFailed'));

      expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({
        [HOUSE_PHOTO.filePath]: 'evidence-1',
      });
      expect(DraftStorageService.hasDraft('case-1')).toBe(false);

      await act(async () => {
        result.current.submit(onSubmitted);
      });
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

      // house, door (failed), door (retried) — the house photo is never re-sent.
      expect(uploadedDocumentTypeCodes()).toEqual(['house_photo_1', 'door_number', 'door_number']);
      expect(caseRepository.submitVerificationOutcome).toHaveBeenCalledTimes(1);
      expect(EvidenceReceiptStorageService.getReceipts('case-1')).toEqual({});
    });

    it('keeps a saved draft when the evidence upload fails', async () => {
      jest
        .mocked(caseEvidenceRepository.uploadCaseEvidence)
        .mockRejectedValueOnce(new CaseEvidenceUploadError('timeout'));
      const { result } = await renderLoadedCase(TWO_PHOTOS);
      await act(async () => {
        result.current.saveDraft();
      });

      await act(async () => {
        result.current.submit(jest.fn());
      });
      await waitFor(() => expect(result.current.submitError).toBe('evidenceUploadFailed'));

      expect(DraftStorageService.loadDraft('case-1')?.capturedPhotos).toHaveLength(2);
    });
  });
});
