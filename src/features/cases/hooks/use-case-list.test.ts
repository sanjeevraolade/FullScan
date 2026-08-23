import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as caseRepository from '@/repositories/case-repository';
import { useSessionStore } from '@/store/session';
import type { Case } from '@/domain/case';
import type { FieldExecutive } from '@/domain/field-executive';

import { useCaseList } from './use-case-list';

jest.mock('@/repositories/case-repository');

const mockFieldExecutive: FieldExecutive = {
  id: 'fe-001',
  name: 'Amit Verma',
  email: 'amit.verma@fullscan.example',
  role: 'Field Agent',
};

function buildCase(overrides: Partial<Case>): Case {
  return {
    id: 'case-1',
    caseRef: 'FS-2026-00001',
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'Flat 204, Madhapur, Hyderabad',
    bucket: 'new',
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('useCaseList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({ fieldExecutive: mockFieldExecutive });
  });

  afterEach(() => {
    useSessionStore.setState({ fieldExecutive: null });
  });

  it('loads the field executive and cases, grouping counts by bucket', async () => {
    jest.mocked(caseRepository.fetchCases).mockResolvedValue([
      buildCase({ id: 'c1', bucket: 'new' }),
      buildCase({ id: 'c2', bucket: 'new' }),
      buildCase({ id: 'c3', bucket: 'pending' }),
    ]);

    const { result } = await renderHook(() => useCaseList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.fieldExecutive).toEqual(mockFieldExecutive);
    expect(result.current.bucketCounts).toEqual({ new: 2, pending: 1, beyondTat: 0, completed: 0 });
    // Default selected bucket is 'new'.
    expect(result.current.visibleCases.map((item) => item.id)).toEqual(['c1', 'c2']);
  });

  it('surfaces a network error key when loading fails', async () => {
    jest.mocked(caseRepository.fetchCases).mockRejectedValue(new Error('boom'));

    const { result } = await renderHook(() => useCaseList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.loadError).toBe('network');
    expect(result.current.visibleCases).toEqual([]);
  });

  it('filters visible cases by search query within the selected bucket', async () => {
    jest.mocked(caseRepository.fetchCases).mockResolvedValue([
      buildCase({ id: 'c1', bucket: 'new', candidateName: 'Rahul Sharma' }),
      buildCase({ id: 'c2', bucket: 'new', candidateName: 'Priya Verma' }),
    ]);

    const { result } = await renderHook(() => useCaseList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.setSearchQuery('priya');
    });

    expect(result.current.visibleCases.map((item) => item.id)).toEqual(['c2']);
  });

  it('switches the visible bucket when selectBucket is called', async () => {
    jest.mocked(caseRepository.fetchCases).mockResolvedValue([buildCase({ id: 'c1', bucket: 'pending' })]);

    const { result } = await renderHook(() => useCaseList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.visibleCases).toHaveLength(0);

    await act(async () => {
      result.current.selectBucket('pending');
    });

    expect(result.current.visibleCases).toHaveLength(1);
  });

  it('moves an accepted case from New to Pending', async () => {
    jest.mocked(caseRepository.fetchCases).mockResolvedValue([buildCase({ id: 'c1', bucket: 'new' })]);
    jest.mocked(caseRepository.acceptCase).mockResolvedValue(buildCase({ id: 'c1', bucket: 'pending' }));

    const { result } = await renderHook(() => useCaseList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.acceptCase('c1');
    });

    await waitFor(() => expect(result.current.acceptingCaseId).toBeNull());

    expect(result.current.bucketCounts).toEqual({ new: 0, pending: 1, beyondTat: 0, completed: 0 });
  });

  it('refreshes the case list on demand', async () => {
    jest.mocked(caseRepository.fetchCases).mockResolvedValue([buildCase({ id: 'c1', bucket: 'new' })]);

    const { result } = await renderHook(() => useCaseList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    jest.mocked(caseRepository.fetchCases).mockResolvedValue([
      buildCase({ id: 'c1', bucket: 'new' }),
      buildCase({ id: 'c2', bucket: 'new' }),
    ]);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    expect(result.current.bucketCounts.new).toBe(2);
  });
});
