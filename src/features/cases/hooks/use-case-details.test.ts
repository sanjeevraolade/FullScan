import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as caseRepository from '@/repositories/case-repository';
import { useReferenceDataStore } from '@/store/reference-data';
import type { Case, CaseDetail } from '@/domain/case';
import type { ReferenceData } from '@/domain/reference-data';

import { useCaseDetails } from './use-case-details';

jest.mock('@/repositories/case-repository');

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
    gpsCheck: { targetLatitude: 17.4452, targetLongitude: 78.3821, distanceMeters: 18, isWithinRange: true },
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

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.caseDetail?.caseRef).toBe('FS-2026-00001');
    expect(result.current.verificationStatus).toBe('utv');
    expect(result.current.isUtvSectionVisible).toBe(true);
    expect(result.current.respondentName).toBe('Anita');
  });

  it('defaults the status and photo tag to the first reference-data option when none is set', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.verificationStatus).toBe('verified_clear');
    expect(result.current.selectedPhotoTag).toBe('house_photo_1');
  });

  it('surfaces a network error key when loading fails', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockRejectedValue(new Error('boom'));

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.loadError).toBe('network');
    expect(result.current.caseDetail).toBeNull();
  });

  it('shows the Insufficient section only when that status is selected', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isInsufficientSectionVisible).toBe(false);

    await act(async () => {
      result.current.selectVerificationStatus('insufficient');
    });

    expect(result.current.isInsufficientSectionVisible).toBe(true);
    expect(result.current.isUtvSectionVisible).toBe(false);
  });

  it('shows the Verified Residence section only for Verified Clear within GPS range', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(
      buildCaseDetail({ gpsCheck: { targetLatitude: 0, targetLongitude: 0, distanceMeters: 2100, isWithinRange: false } }),
    );

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.selectVerificationStatus('verified_clear');
    });

    expect(result.current.isVerifiedResidenceSectionVisible).toBe(false);
  });

  it('submits the verification outcome and invokes the callback on success', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail());
    jest.mocked(caseRepository.submitVerificationOutcome).mockResolvedValue(buildCase());

    const { result } = await renderHook(() => useCaseDetails('case-1'));
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

    const { result } = await renderHook(() => useCaseDetails('case-1'));
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

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(true);
    expect(result.current.shouldShowDetailFormSections).toBe(false);
    expect(result.current.isReadOnly).toBe(false);
  });

  it('marks a pending bucket case as editable with all sections visible', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'pending' }));

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(false);
    expect(result.current.shouldShowDetailFormSections).toBe(true);
    expect(result.current.isReadOnly).toBe(false);
  });

  it('marks a beyondTat bucket case as editable with all sections visible', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'beyondTat' }));

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(false);
    expect(result.current.shouldShowDetailFormSections).toBe(true);
    expect(result.current.isReadOnly).toBe(false);
  });

  it('marks a completed bucket case as read-only with all sections visible', async () => {
    jest.mocked(caseRepository.fetchCaseDetail).mockResolvedValue(buildCaseDetail({ bucket: 'completed' }));

    const { result } = await renderHook(() => useCaseDetails('case-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNewCase).toBe(false);
    expect(result.current.shouldShowDetailFormSections).toBe(true);
    expect(result.current.isReadOnly).toBe(true);
  });
});
