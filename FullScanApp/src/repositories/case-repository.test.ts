import { LoggerService } from '@/infrastructure/logger';
import { apiClient } from '@/infrastructure/networking';

import {
  acceptCase,
  fetchCaseCounts,
  fetchCaseDetail,
  fetchCasesPage,
  submitVerificationOutcome,
} from './case-repository';

jest.mock('@/infrastructure/networking', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));

/** Minimum viable payload — only the fields these tests care about vary. */
function buildCaseDetailDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'case-1',
    checkId: 'case-1',
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

/** The new case summary shape: `checkId` added, no `caseId` and no `bucket`. */
function buildCaseDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'case-0123-comp-1',
    checkId: 'case-0123-comp-1',
    caseRef: 'FS-2026-00123',
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'H.No. 11-2/2, Near Chanda Nagar Railway Station',
    updatedAt: '2026-10-04 09:15:02',
    ...overrides,
  };
}

function mockGetResponse(data: unknown): void {
  jest.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data } });
}

describe('fetchCaseDetail identity fields', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps checkId, drops the parent caseId and keeps the bucket', async () => {
    mockCaseDetailResponse(
      buildCaseDetailDto({
        bucket: 'beyond_tat',
        siblingComponents: [
          {
            id: 'case-2',
            verificationType: 'Employment',
            addressType: null,
            componentStatus: 'component_accepted',
            bucket: 'completed',
          },
        ],
      }),
    );

    const detail = await fetchCaseDetail('case-1');

    expect(apiClient.get).toHaveBeenCalledWith('/cases/case-1');
    expect(detail.id).toBe('case-1');
    expect(detail.checkId).toBe('case-1');
    expect(detail).not.toHaveProperty('caseId');
    expect(detail.bucket).toBe('beyondTat');
    expect(detail.siblingComponents[0]?.bucket).toBe('completed');
  });
});

describe('fetchCasesPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requests a first page by type alone and maps the new summary shape', async () => {
    mockGetResponse({ type: 'pending', items: [buildCaseDto()], nextCursor: null, pageSize: 100 });

    const page = await fetchCasesPage('pending', null);

    // No `cursor` key at all: the route's query schema rejects unknown or empty params.
    expect(apiClient.get).toHaveBeenCalledWith('/cases', { params: { type: 'pending' } });
    expect(page.nextCursor).toBeNull();
    expect(page.items).toEqual([
      {
        id: 'case-0123-comp-1',
        checkId: 'case-0123-comp-1',
        caseRef: 'FS-2026-00123',
        clientName: 'ABC Pvt Ltd',
        candidateName: 'Rahul Sharma',
        verificationType: 'Address',
        address: 'H.No. 11-2/2, Near Chanda Nagar Railway Station',
        updatedAt: new Date('2026-10-04 09:15:02'),
      },
    ]);
    expect(page.items[0]).not.toHaveProperty('bucket');
    expect(page.items[0]).not.toHaveProperty('caseId');
  });

  it('maps the beyondTat bucket to the beyond_tat type', async () => {
    mockGetResponse({ type: 'beyond_tat', items: [], nextCursor: null, pageSize: 100 });

    await fetchCasesPage('beyondTat', null);

    expect(apiClient.get).toHaveBeenCalledWith('/cases', { params: { type: 'beyond_tat' } });
  });

  it.each([
    ['new', 'new'],
    ['pending', 'pending'],
    ['completed', 'completed'],
  ] as const)('maps the %s bucket to the %s type', async (bucket, type) => {
    mockGetResponse({ type, items: [], nextCursor: null, pageSize: 100 });

    await fetchCasesPage(bucket, null);

    expect(apiClient.get).toHaveBeenCalledWith('/cases', { params: { type } });
  });

  it('passes the cursor through unchanged and returns the next one', async () => {
    mockGetResponse({
      type: 'completed',
      items: [buildCaseDto({ id: 'case-2', checkId: 'case-2' })],
      nextCursor: 'eyJ0IjoiY29tcGxldGVkIn0',
      pageSize: 1,
    });

    const page = await fetchCasesPage('completed', 'eyJ0IjoiY29tcGxldGVkIiwibyI6MX0');

    expect(apiClient.get).toHaveBeenCalledWith('/cases', {
      params: { type: 'completed', cursor: 'eyJ0IjoiY29tcGxldGVkIiwibyI6MX0' },
    });
    expect(page.nextCursor).toBe('eyJ0IjoiY29tcGxldGVkIn0');
    expect(page.items.map((item) => item.id)).toEqual(['case-2']);
  });

  it('accepts an empty page', async () => {
    mockGetResponse({ type: 'pending', items: [], nextCursor: null, pageSize: 100 });

    await expect(fetchCasesPage('pending', 'cursor-1')).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('treats an empty-string cursor as the last page rather than sending it back', async () => {
    const warnSpy = jest.spyOn(LoggerService, 'warn');
    mockGetResponse({ type: 'pending', items: [], nextCursor: '', pageSize: 100 });

    const page = await fetchCasesPage('pending', null);

    expect(page.nextCursor).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('mapNextCursor'),
      expect.objectContaining({ receivedType: 'string' }),
    );
    warnSpy.mockRestore();
  });

  it('propagates a transport failure to the caller', async () => {
    jest.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));

    await expect(fetchCasesPage('pending', null)).rejects.toThrow('Network Error');
  });
});

describe('fetchCaseCounts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('maps every tab count, beyond_tat to beyondTat', async () => {
    mockGetResponse({ new: 7, pending: 10, beyond_tat: 3, completed: 0 });

    const counts = await fetchCaseCounts();

    expect(apiClient.get).toHaveBeenCalledWith('/cases/counts');
    expect(counts).toEqual({ new: 7, pending: 10, beyondTat: 3, completed: 0 });
  });

  it('maps a missing key to 0 and warns', async () => {
    const warnSpy = jest.spyOn(LoggerService, 'warn');
    mockGetResponse({ new: 7, pending: 10, completed: 2 });

    const counts = await fetchCaseCounts();

    expect(counts).toEqual({ new: 7, pending: 10, beyondTat: 0, completed: 2 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('mapCount'),
      expect.objectContaining({ key: 'beyond_tat', receivedType: 'undefined' }),
    );
  });

  it('maps non-numeric (and non-count) values to 0 and warns for each', async () => {
    const warnSpy = jest.spyOn(LoggerService, 'warn');
    mockGetResponse({ new: '7', pending: null, beyond_tat: -1, completed: 2.5 });

    const counts = await fetchCaseCounts();

    expect(counts).toEqual({ new: 0, pending: 0, beyondTat: 0, completed: 0 });
    expect(warnSpy).toHaveBeenCalledTimes(4);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('mapCount'),
      expect.objectContaining({ key: 'pending', receivedType: 'null' }),
    );
  });

  it('maps a missing data object to all zeros', async () => {
    mockGetResponse(null);

    await expect(fetchCaseCounts()).resolves.toEqual({
      new: 0,
      pending: 0,
      beyondTat: 0,
      completed: 0,
    });
  });
});

describe('accept and verification-outcome responses', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps the accept response from the new summary shape', async () => {
    jest
      .mocked(apiClient.patch)
      .mockResolvedValue({ data: { success: true, data: buildCaseDto() } });

    const accepted = await acceptCase('case-0123-comp-1');

    expect(apiClient.patch).toHaveBeenCalledWith('/cases/case-0123-comp-1/accept');
    expect(accepted.checkId).toBe('case-0123-comp-1');
    expect(accepted).not.toHaveProperty('bucket');
  });

  it('maps the verification-outcome response from the new summary shape', async () => {
    jest
      .mocked(apiClient.post)
      .mockResolvedValue({ data: { success: true, data: buildCaseDto() } });

    const submitted = await submitVerificationOutcome('case-0123-comp-1', {
      verificationStatus: 'utv',
      utvReason: 'shifted',
      utvRemarks: null,
      insufficientReason: null,
      insufficientRemarks: null,
      residenceType: null,
      addressType: null,
      respondent: null,
      isSignatureCaptured: false,
      currentLatitude: 17.4452,
      currentLongitude: 78.3821,
      distanceToCaseMeters: 12,
      forceProceed: false,
    });

    expect(submitted.id).toBe('case-0123-comp-1');
    expect(submitted.checkId).toBe('case-0123-comp-1');
    expect(submitted).not.toHaveProperty('bucket');
    expect(submitted).not.toHaveProperty('caseId');
  });
});

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
