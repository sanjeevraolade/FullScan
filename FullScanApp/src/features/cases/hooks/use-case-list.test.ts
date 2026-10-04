import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { RenderHookResult } from '@testing-library/react-native';

import { resolveAcceptTransition, resolveVerificationOutcomeTransition } from '@/domain/case';
import * as caseRepository from '@/repositories/case-repository';
import { useSessionStore } from '@/store/session';
import type { Case, CaseBucket, CaseBucketCounts } from '@/domain/case';
import type { FieldExecutive } from '@/domain/field-executive';
import type { CasePage } from '@/repositories/case-repository';

import { CaseListCache } from '../services/case-list-cache';

import { useCaseList } from './use-case-list';
import type { UseCaseListResult } from './use-case-list';

jest.mock('@/repositories/case-repository');

const mockFieldExecutive: FieldExecutive = {
  id: 'fe-001',
  name: 'Amit Verma',
  email: 'amit.verma@fullscan.example',
  role: 'Field Agent',
};

const COUNTS: CaseBucketCounts = { new: 7, pending: 10, beyondTat: 7, completed: 7 };

function buildCase(id: string, overrides: Partial<Case> = {}): Case {
  return {
    id,
    checkId: id,
    caseRef: `FS-2026-${id}`,
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'Flat 204, Madhapur, Hyderabad',
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

function page(ids: string[], nextCursor: string | null = null): CasePage {
  return { items: ids.map((id) => buildCase(id)), nextCursor };
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

type PageResponse = CasePage | Error | Deferred<CasePage>;

/**
 * Serves `fetchCasesPage` from a table keyed `bucket:cursor` (`first` for a
 * first page). An unlisted key fails the request, so an unexpected network
 * call shows up as a failure rather than passing silently.
 */
function mockPages(responses: Record<string, PageResponse>): void {
  jest.mocked(caseRepository.fetchCasesPage).mockImplementation(async (bucket, cursor) => {
    const response = responses[`${bucket}:${cursor ?? 'first'}`];
    if (response === undefined) {
      throw new Error(`unexpected page request ${bucket}:${cursor ?? 'first'}`);
    }
    if (response instanceof Error) {
      throw response;
    }
    if ('promise' in response) {
      return response.promise;
    }
    return response;
  });
}

function pageRequests(bucket: CaseBucket): (string | null)[] {
  return jest
    .mocked(caseRepository.fetchCasesPage)
    .mock.calls.filter(([requestedBucket]) => requestedBucket === bucket)
    .map(([, cursor]) => cursor);
}

function visibleIds(cases: readonly Case[]): string[] {
  return cases.map((item) => item.id);
}

function renderCaseList(): Promise<RenderHookResult<UseCaseListResult, unknown>> {
  return renderHook(() => useCaseList());
}

describe('useCaseList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CaseListCache.clear();
    useSessionStore.setState({ fieldExecutive: mockFieldExecutive });
    jest.mocked(caseRepository.fetchCaseCounts).mockResolvedValue(COUNTS);
  });

  afterEach(() => {
    CaseListCache.clear();
    useSessionStore.setState({ fieldExecutive: null });
  });

  describe('initial load and lazy tabs', () => {
    it('requests the counts and New page 1 in parallel on mount, and nothing else', async () => {
      const counts = createDeferred<CaseBucketCounts>();
      const newPage = createDeferred<CasePage>();
      jest.mocked(caseRepository.fetchCaseCounts).mockReturnValue(counts.promise);
      mockPages({ 'new:first': newPage });

      const { result } = await renderCaseList();

      // Both are in flight before either has answered.
      expect(caseRepository.fetchCaseCounts).toHaveBeenCalledTimes(1);
      expect(caseRepository.fetchCasesPage).toHaveBeenCalledTimes(1);
      expect(caseRepository.fetchCasesPage).toHaveBeenCalledWith('new', null);
      expect(result.current.selectedBucket).toBe('new');
      expect(result.current.isLoading).toBe(true);
      expect(result.current.fieldExecutive).toEqual(mockFieldExecutive);

      await act(async () => {
        newPage.resolve(page(['n1', 'n2']));
        counts.resolve(COUNTS);
      });

      expect(result.current.isLoading).toBe(false);
      expect(visibleIds(result.current.visibleCases)).toEqual(['n1', 'n2']);
    });

    it('requests a tab only the first time it is selected', async () => {
      mockPages({ 'new:first': page(['n1']), 'pending:first': page(['p1', 'p2'], 'p-cursor') });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(pageRequests('pending')).toEqual([]);
      expect(pageRequests('beyondTat')).toEqual([]);
      expect(pageRequests('completed')).toEqual([]);

      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1', 'p2']));

      expect(pageRequests('pending')).toEqual([null]);
      expect(pageRequests('completed')).toEqual([]);
    });

    it('shows a cached tab instantly, with no further request', async () => {
      mockPages({ 'new:first': page(['n1']), 'pending:first': page(['p1']) });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1']));

      await act(async () => {
        result.current.selectBucket('new');
      });

      expect(result.current.isLoading).toBe(false);
      expect(visibleIds(result.current.visibleCases)).toEqual(['n1']);
      expect(pageRequests('new')).toEqual([null]);
    });

    it('keeps the cache across the screen unmounting and remounting', async () => {
      mockPages({ 'new:first': page(['n1']) });

      const first = await renderCaseList();
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));
      await first.unmount();
      jest.clearAllMocks();

      const second = await renderCaseList();

      expect(second.result.current.isLoading).toBe(false);
      expect(visibleIds(second.result.current.visibleCases)).toEqual(['n1']);
      expect(second.result.current.bucketBadgeCounts.pending).toBe(10);
      expect(caseRepository.fetchCasesPage).not.toHaveBeenCalled();
      expect(caseRepository.fetchCaseCounts).not.toHaveBeenCalled();
    });

    it('fetches again after logout has cleared the cache', async () => {
      mockPages({ 'new:first': page(['n1']) });

      const first = await renderCaseList();
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));
      await first.unmount();

      CaseListCache.clear();
      jest.clearAllMocks();
      mockPages({ 'new:first': page(['n9']) });
      jest.mocked(caseRepository.fetchCaseCounts).mockResolvedValue(COUNTS);

      const second = await renderCaseList();
      await waitFor(() => expect(visibleIds(second.result.current.visibleCases)).toEqual(['n9']));

      expect(caseRepository.fetchCasesPage).toHaveBeenCalledWith('new', null);
      expect(caseRepository.fetchCaseCounts).toHaveBeenCalledTimes(1);
    });
  });

  describe('infinite scroll', () => {
    it('appends next pages, de-duplicating by id, until the cursor runs out', async () => {
      mockPages({
        'new:first': page(['n1']),
        'pending:first': page(['p1', 'p2'], 'cursor-1'),
        'pending:cursor-1': page(['p2', 'p3'], 'cursor-2'),
        'pending:cursor-2': page(['p4']),
      });

      const { result } = await renderCaseList();
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1', 'p2']));

      await act(async () => {
        result.current.loadMore();
      });
      await waitFor(() =>
        expect(visibleIds(result.current.visibleCases)).toEqual(['p1', 'p2', 'p3']),
      );

      await act(async () => {
        result.current.loadMore();
      });
      await waitFor(() =>
        expect(visibleIds(result.current.visibleCases)).toEqual(['p1', 'p2', 'p3', 'p4']),
      );

      await act(async () => {
        result.current.loadMore();
      });

      expect(pageRequests('pending')).toEqual([null, 'cursor-1', 'cursor-2']);
    });

    it('allows only one request in flight per tab', async () => {
      const nextPage = createDeferred<CasePage>();
      mockPages({
        'new:first': page(['n1']),
        'pending:first': page(['p1'], 'cursor-1'),
        'pending:cursor-1': nextPage,
      });

      const { result } = await renderCaseList();
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1']));

      await act(async () => {
        result.current.loadMore();
        result.current.loadMore();
      });
      await act(async () => {
        result.current.loadMore();
        result.current.retryLoadMore();
      });

      expect(result.current.isLoadingMore).toBe(true);
      expect(pageRequests('pending')).toEqual([null, 'cursor-1']);

      await act(async () => {
        nextPage.resolve(page(['p2']));
      });

      expect(result.current.isLoadingMore).toBe(false);
      expect(visibleIds(result.current.visibleCases)).toEqual(['p1', 'p2']);
    });

    it('keeps the loaded items when a next page fails, and retries from the footer', async () => {
      mockPages({
        'new:first': page(['n1', 'n2'], 'cursor-1'),
        'new:cursor-1': new Error('offline'),
      });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.loadMore();
      });
      await waitFor(() => expect(result.current.loadMoreError).toBe('network'));

      expect(visibleIds(result.current.visibleCases)).toEqual(['n1', 'n2']);
      expect(result.current.loadError).toBeNull();
      expect(result.current.isLoadingMore).toBe(false);

      // Scrolling again doesn't hammer a request that just failed — Retry does.
      await act(async () => {
        result.current.loadMore();
      });
      expect(pageRequests('new')).toEqual([null, 'cursor-1']);

      mockPages({ 'new:first': page(['n1', 'n2'], 'cursor-1'), 'new:cursor-1': page(['n3']) });
      await act(async () => {
        result.current.retryLoadMore();
      });
      await waitFor(() =>
        expect(visibleIds(result.current.visibleCases)).toEqual(['n1', 'n2', 'n3']),
      );

      expect(result.current.loadMoreError).toBeNull();
      expect(pageRequests('new')).toEqual([null, 'cursor-1', 'cursor-1']);
    });

    it('drops a next page that lands after a refresh superseded it', async () => {
      const stalePage = createDeferred<CasePage>();
      mockPages({ 'new:first': page(['n1'], 'cursor-1'), 'new:cursor-1': stalePage });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        result.current.loadMore();
      });

      mockPages({ 'new:first': page(['n5', 'n6']), 'new:cursor-1': stalePage });
      await act(async () => {
        result.current.refresh();
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['n5', 'n6']));

      await act(async () => {
        stalePage.resolve(page(['n2']));
      });

      expect(visibleIds(result.current.visibleCases)).toEqual(['n5', 'n6']);
      expect(result.current.isLoadingMore).toBe(false);
    });
  });

  describe('refresh', () => {
    it("re-fetches the counts and the current tab, and discards every other tab's cache", async () => {
      mockPages({
        'new:first': page(['n1']),
        'pending:first': page(['p1'], 'cursor-1'),
        'completed:first': page(['c1']),
      });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        result.current.selectBucket('completed');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['c1']));
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1']));

      mockPages({
        'new:first': page(['n2']),
        'pending:first': page(['p9']),
        'completed:first': page(['c1']),
      });
      await act(async () => {
        result.current.refresh();
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p9']));

      expect(caseRepository.fetchCaseCounts).toHaveBeenCalledTimes(2);
      expect(pageRequests('pending')).toEqual([null, null]);
      // The other tabs were not re-fetched yet — only discarded.
      expect(pageRequests('new')).toEqual([null]);
      expect(pageRequests('completed')).toEqual([null]);
      expect(CaseListCache.getSnapshot().tabs.new).toBeUndefined();
      expect(CaseListCache.getSnapshot().tabs.completed).toBeUndefined();

      // A fresh New draw arrives on its next open.
      await act(async () => {
        result.current.selectBucket('new');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['n2']));
      expect(pageRequests('new')).toEqual([null, null]);
    });

    it('reports refreshing over cached items rather than the first-page loading state', async () => {
      const refreshedPage = createDeferred<CasePage>();
      mockPages({ 'new:first': page(['n1']) });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockPages({ 'new:first': refreshedPage });
      await act(async () => {
        result.current.refresh();
      });

      expect(result.current.isRefreshing).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(visibleIds(result.current.visibleCases)).toEqual(['n1']);

      await act(async () => {
        refreshedPage.resolve(page(['n2']));
      });

      expect(result.current.isRefreshing).toBe(false);
      expect(visibleIds(result.current.visibleCases)).toEqual(['n2']);
    });

    it('keeps the previously loaded items when a refresh fails', async () => {
      mockPages({ 'new:first': page(['n1']) });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockPages({ 'new:first': new Error('offline') });
      await act(async () => {
        result.current.refresh();
      });
      await waitFor(() => expect(result.current.isRefreshing).toBe(false));

      expect(result.current.refreshError).toBe('network');
      expect(result.current.loadError).toBeNull();
      expect(visibleIds(result.current.visibleCases)).toEqual(['n1']);
    });
  });

  describe('first-page errors', () => {
    it('surfaces a network error for the tab, keeps other tabs usable, and Retry re-fetches', async () => {
      mockPages({ 'new:first': new Error('offline'), 'pending:first': page(['p1']) });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.loadError).toBe('network'));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.visibleCases).toEqual([]);

      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1']));
      expect(result.current.loadError).toBeNull();

      // Going back shows the failure again rather than silently re-requesting.
      await act(async () => {
        result.current.selectBucket('new');
      });
      expect(result.current.loadError).toBe('network');
      expect(pageRequests('new')).toEqual([null]);

      mockPages({ 'new:first': page(['n1']), 'pending:first': page(['p1']) });
      await act(async () => {
        result.current.refresh();
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['n1']));

      expect(result.current.loadError).toBeNull();
      expect(pageRequests('new')).toEqual([null, null]);
    });

    it('does not block anything when the counts request fails', async () => {
      jest.mocked(caseRepository.fetchCaseCounts).mockRejectedValue(new Error('offline'));
      mockPages({ 'new:first': page(['n1', 'n2']) });

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.loadError).toBeNull();
      expect(visibleIds(result.current.visibleCases)).toEqual(['n1', 'n2']);
      expect(result.current.bucketBadgeCounts).toEqual({
        new: 2,
        pending: null,
        beyondTat: null,
        completed: null,
      });

      jest.mocked(caseRepository.fetchCaseCounts).mockResolvedValue(COUNTS);
      mockPages({ 'new:first': page(['n1', 'n2']) });
      await act(async () => {
        result.current.refresh();
      });
      await waitFor(() => expect(result.current.bucketBadgeCounts.pending).toBe(10));
    });
  });

  describe('tab badges', () => {
    it('shows labels alone until there is a count or a fully loaded tab', async () => {
      const counts = createDeferred<CaseBucketCounts>();
      const newPage = createDeferred<CasePage>();
      jest.mocked(caseRepository.fetchCaseCounts).mockReturnValue(counts.promise);
      mockPages({ 'new:first': newPage });

      const { result } = await renderCaseList();

      expect(result.current.bucketBadgeCounts).toEqual({
        new: null,
        pending: null,
        beyondTat: null,
        completed: null,
      });

      await act(async () => {
        counts.resolve(COUNTS);
        newPage.resolve(page(['n1', 'n2', 'n3', 'n4']));
      });

      // New's random draw is 7 on the server but 4 were loaded — the list wins.
      expect(result.current.bucketBadgeCounts).toEqual({
        new: 4,
        pending: 10,
        beyondTat: 7,
        completed: 7,
      });
    });

    it('uses the server count for a partly loaded tab and the item count once it is fully loaded', async () => {
      mockPages({
        'new:first': page(['n1']),
        'pending:first': page(['p1', 'p2'], 'cursor-1'),
        'pending:cursor-1': page(['p3']),
      });

      const { result } = await renderCaseList();
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1', 'p2']));

      expect(result.current.bucketBadgeCounts.pending).toBe(10);

      await act(async () => {
        result.current.loadMore();
      });
      await waitFor(() => expect(result.current.bucketBadgeCounts.pending).toBe(3));
    });
  });

  describe('search', () => {
    it("filters the current tab's loaded items by case ref, candidate and client", async () => {
      mockPages({
        'new:first': page([]),
        'pending:first': {
          items: [
            buildCase('p1', { candidateName: 'Rahul Sharma' }),
            buildCase('p2', { candidateName: 'Priya Verma' }),
            buildCase('p3', { clientName: 'Priya Holdings' }),
          ],
          nextCursor: 'cursor-1',
        },
      });

      const { result } = await renderCaseList();
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(result.current.visibleCases).toHaveLength(3));

      await act(async () => {
        result.current.setSearchQuery('priya');
      });

      expect(visibleIds(result.current.visibleCases)).toEqual(['p2', 'p3']);

      await act(async () => {
        result.current.setSearchQuery('FS-2026-p1');
      });

      expect(visibleIds(result.current.visibleCases)).toEqual(['p1']);
      // Local only — searching never asks the server.
      expect(pageRequests('pending')).toEqual([null]);
    });
  });

  describe('cache updates from actions', () => {
    it('accepting from the list removes the case from New, discards Pending and moves the counts', async () => {
      mockPages({ 'new:first': page(['n1', 'n2']), 'pending:first': page(['p1'], 'cursor-1') });
      jest.mocked(caseRepository.acceptCase).mockResolvedValue(buildCase('n1'));

      const { result } = await renderCaseList();
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1']));
      await act(async () => {
        result.current.selectBucket('new');
      });

      await act(async () => {
        result.current.acceptCase('n1');
      });
      await waitFor(() => expect(result.current.acceptingCaseId).toBeNull());

      expect(caseRepository.acceptCase).toHaveBeenCalledWith('n1');
      expect(visibleIds(result.current.visibleCases)).toEqual(['n2']);
      expect(CaseListCache.getSnapshot().tabs.pending).toBeUndefined();
      expect(CaseListCache.getSnapshot().counts).toEqual({ ...COUNTS, new: 6, pending: 11 });
      expect(result.current.bucketBadgeCounts.new).toBe(1);
      expect(result.current.bucketBadgeCounts.pending).toBe(11);
    });

    it('leaves the cache alone when accepting fails', async () => {
      mockPages({ 'new:first': page(['n1', 'n2']) });
      jest.mocked(caseRepository.acceptCase).mockRejectedValue(new Error('offline'));

      const { result } = await renderCaseList();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.acceptCase('n1');
      });
      await waitFor(() => expect(result.current.acceptingCaseId).toBeNull());

      expect(visibleIds(result.current.visibleCases)).toEqual(['n1', 'n2']);
      expect(CaseListCache.getSnapshot().counts).toEqual(COUNTS);
    });

    it('reflects an outcome submitted from Case Details while the list stays mounted', async () => {
      mockPages({
        'new:first': page(['n1']),
        'pending:first': page(['p1', 'p2'], 'cursor-1'),
        'completed:first': page(['c1']),
      });

      const { result } = await renderCaseList();
      await act(async () => {
        result.current.selectBucket('completed');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['c1']));
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1', 'p2']));

      // What useCaseDetails does after a successful submission.
      await act(async () => {
        CaseListCache.applyCaseTransition('p2', resolveVerificationOutcomeTransition('pending'));
      });

      expect(visibleIds(result.current.visibleCases)).toEqual(['p1']);
      expect(CaseListCache.getSnapshot().tabs.completed).toBeUndefined();
      expect(result.current.bucketBadgeCounts.pending).toBe(9);
      expect(result.current.bucketBadgeCounts.completed).toBe(8);
      expect(pageRequests('completed')).toEqual([null]);
    });

    it('re-loads the selected tab when an action elsewhere discards it', async () => {
      mockPages({ 'new:first': page(['n1']), 'pending:first': page(['p1']) });

      const { result } = await renderCaseList();
      await act(async () => {
        result.current.selectBucket('pending');
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['p1']));

      mockPages({ 'new:first': page(['n1']), 'pending:first': page(['n1', 'p1']) });
      await act(async () => {
        CaseListCache.applyCaseTransition('n1', resolveAcceptTransition());
      });
      await waitFor(() => expect(visibleIds(result.current.visibleCases)).toEqual(['n1', 'p1']));

      expect(pageRequests('pending')).toEqual([null, null]);
    });
  });
});
