import { apiClient } from '@/infrastructure/networking';

import { fetchCaseDetail } from './case-repository';

jest.mock('@/infrastructure/networking', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));

/** Minimum viable payload — only the fields these tests care about vary. */
function buildCaseDetailDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'case-1',
    caseId: 'case-parent-1',
    caseRef: 'FS-2026-00001',
    bucket: 'pending',
    tatDueAt: '2026-09-30T00:00:00.000Z',
    candidateName: 'Rahul Sharma',
    fatherOrSpouseName: 'Suresh Sharma',
    employerName: 'ABC Pvt Ltd',
    verificationType: 'Address',
    clientName: 'ABC Pvt Ltd',
    address: 'Flat 204, Madhapur, Hyderabad',
    addressType: 'present',
    residenceType: 'rented',
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

function mockCaseDetailResponse(dto: Record<string, unknown>): void {
  jest.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: dto } });
}

/**
 * A case carries at most coordinates or an address string, and both are
 * permanently supported, so the only interesting mapping question is when
 * coordinates count as present.
 */
describe('fetchCaseDetail case coordinates', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps flat latitude/longitude from the agreed contract', async () => {
    mockCaseDetailResponse(buildCaseDetailDto({ latitude: 17.4452, longitude: 78.3821 }));

    const detail = await fetchCaseDetail('case-1');

    expect(detail.coordinates).toEqual({ latitude: 17.4452, longitude: 78.3821 });
  });

  it('still reads the nested gpsCheck shape the current API sends', async () => {
    mockCaseDetailResponse(
      buildCaseDetailDto({
        gpsCheck: {
          targetLatitude: 12.9716,
          targetLongitude: 77.5946,
          distanceMeters: 18,
          isWithinRange: true,
        },
      }),
    );

    const detail = await fetchCaseDetail('case-1');

    expect(detail.coordinates).toEqual({ latitude: 12.9716, longitude: 77.5946 });
  });

  it('exposes no server-computed distance or in-range verdict to callers', async () => {
    mockCaseDetailResponse(
      buildCaseDetailDto({
        gpsCheck: {
          targetLatitude: 12.9716,
          targetLongitude: 77.5946,
          distanceMeters: 18,
          isWithinRange: true,
        },
      }),
    );

    const detail = await fetchCaseDetail('case-1');

    expect(detail).not.toHaveProperty('gpsCheck');
    expect(Object.keys(detail)).not.toContain('distanceMeters');
    expect(Object.keys(detail)).not.toContain('isWithinRange');
  });

  it('yields null coordinates for an address-only case', async () => {
    mockCaseDetailResponse(buildCaseDetailDto());

    const detail = await fetchCaseDetail('case-1');

    expect(detail.coordinates).toBeNull();
    expect(detail.address).toBe('Flat 204, Madhapur, Hyderabad');
  });

  it('treats the backend 0,0 column default as "not geocoded yet"', async () => {
    mockCaseDetailResponse(buildCaseDetailDto({ latitude: 0, longitude: 0 }));

    const detail = await fetchCaseDetail('case-1');

    expect(detail.coordinates).toBeNull();
  });

  it('rejects a half-populated or out-of-range pair rather than half-trusting it', async () => {
    mockCaseDetailResponse(buildCaseDetailDto({ latitude: 17.4452, longitude: null }));
    await expect(fetchCaseDetail('case-1')).resolves.toMatchObject({ coordinates: null });

    mockCaseDetailResponse(buildCaseDetailDto({ latitude: 999, longitude: 78.3821 }));
    await expect(fetchCaseDetail('case-1')).resolves.toMatchObject({ coordinates: null });
  });
});
