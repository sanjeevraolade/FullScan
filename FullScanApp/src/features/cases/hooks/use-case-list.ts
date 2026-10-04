import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { resolveAcceptTransition } from '@/domain/case';
import { LoggerService } from '@/infrastructure/logger';
import {
  acceptCase as requestAcceptCase,
  fetchCaseCounts,
  fetchCasesPage,
} from '@/repositories/case-repository';
import { useSessionStore } from '@/store/session';
import type { Case, CaseBucket } from '@/domain/case';
import type { FieldExecutive } from '@/domain/field-executive';

import { CaseListCache } from '../services/case-list-cache';
import type { CaseListCacheSnapshot } from '../services/case-list-cache';

const FILE_NAME = 'use-case-list.ts';

/** Tab order for the case list — Completed is spec'd but shown last. */
export const CASE_LIST_BUCKETS: readonly CaseBucket[] = [
  'new',
  'pending',
  'beyondTat',
  'completed',
];

export type CaseListLoadErrorKey = 'network';

/** Per tab: the badge number, or `null` to show the label alone. */
export type CaseBucketBadgeCounts = Readonly<Record<CaseBucket, number | null>>;

type TabRequestKind = 'firstPage' | 'nextPage';

/**
 * A page request for one tab — or, once it fails, its failure — tied to the
 * cache generation it was started against. It only counts while that
 * generation is current, so a refresh, an accept made from Case Details or a
 * logout silently retires it.
 */
interface TabRequest {
  readonly requestId: number;
  readonly kind: TabRequestKind;
  readonly generation: number;
}

type TabRequests = Readonly<Partial<Record<CaseBucket, TabRequest>>>;

export interface UseCaseListResult {
  readonly fieldExecutive: FieldExecutive | null;
  readonly selectedBucket: CaseBucket;
  readonly selectBucket: (bucket: CaseBucket) => void;
  readonly bucketBadgeCounts: CaseBucketBadgeCounts;
  /** The selected tab's loaded items, filtered by the search query. */
  readonly visibleCases: Case[];
  readonly searchQuery: string;
  readonly setSearchQuery: (query: string) => void;
  /** The selected tab has nothing cached yet and its first page is on the way. */
  readonly isLoading: boolean;
  /** A refresh is in flight over a tab that already shows items. */
  readonly isRefreshing: boolean;
  /** The selected tab's first page failed and there is nothing cached to show instead. */
  readonly loadError: CaseListLoadErrorKey | null;
  /** A refresh failed; the tab's previously loaded items are still shown. */
  readonly refreshError: CaseListLoadErrorKey | null;
  /** Re-fetches the counts and the selected tab's first page, and discards every other tab. */
  readonly refresh: () => void;
  readonly isLoadingMore: boolean;
  /** The last next-page request failed; loaded items stay and `retryLoadMore` tries again. */
  readonly loadMoreError: CaseListLoadErrorKey | null;
  /** End-of-list trigger: loads the selected tab's next page, if it has one and nothing is in flight. */
  readonly loadMore: () => void;
  readonly retryLoadMore: () => void;
  readonly acceptingCaseId: string | null;
  readonly acceptCase: (caseId: string) => void;
}

function matchesSearch(candidate: Case, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    LoggerService.info(`${FILE_NAME}: matchesSearch: no query — case included`, {
      caseId: candidate.id,
    });
    return true;
  }
  // Query text is logged only as a length: a field executive can search by
  // candidate name, so the term itself is potentially PII.
  const isMatch =
    candidate.caseRef.toLowerCase().includes(normalizedQuery) ||
    candidate.candidateName.toLowerCase().includes(normalizedQuery) ||
    candidate.clientName.toLowerCase().includes(normalizedQuery);
  LoggerService.info(`${FILE_NAME}: matchesSearch: query evaluated`, {
    caseId: candidate.id,
    queryLength: normalizedQuery.length,
    isMatch,
  });
  return isMatch;
}

/**
 * A fully loaded tab shows how many items it actually holds — which keeps
 * New's badge equal to its random draw, and every badge right after a local
 * accept/outcome update. Otherwise the server count, or no number at all.
 */
function resolveBadgeCounts(cache: CaseListCacheSnapshot): CaseBucketBadgeCounts {
  const badgeCounts: Record<CaseBucket, number | null> = {
    new: null,
    pending: null,
    beyondTat: null,
    completed: null,
  };
  CASE_LIST_BUCKETS.forEach((bucket) => {
    const tab = cache.tabs[bucket];
    badgeCounts[bucket] =
      tab !== undefined && tab.nextCursor === null
        ? tab.items.length
        : cache.counts?.[bucket] ?? null;
  });
  LoggerService.info(`${FILE_NAME}: resolveBadgeCounts: resolved`, { ...badgeCounts });
  return badgeCounts;
}

/** The request (or failure) for `bucket` if it still belongs to the tab's current generation. */
function selectCurrentRequest(
  requests: TabRequests,
  cache: CaseListCacheSnapshot,
  bucket: CaseBucket,
): TabRequest | null {
  const request = requests[bucket];
  const isCurrent = request !== undefined && request.generation === cache.tabGenerations[bucket];
  LoggerService.info(`${FILE_NAME}: selectCurrentRequest: resolved`, {
    bucket,
    hasRequest: request !== undefined,
    isCurrent,
  });
  return isCurrent ? request : null;
}

function withoutBucket(requests: TabRequests, bucket: CaseBucket): TabRequests {
  LoggerService.info(`${FILE_NAME}: withoutBucket: releasing tab entry`, { bucket });
  const next = { ...requests };
  delete next[bucket];
  return next;
}

/**
 * Owns the case-list landing page's data: per-tab lazy loading, infinite
 * scroll, refresh, the tab badges, local search and the Accept action, plus
 * the field executive identity read from the session store. Loaded pages and
 * counts live in `CaseListCache`, so they survive this screen unmounting;
 * only request status is local. Screens read from this hook only — no
 * networking happens in the screen.
 */
export function useCaseList(): UseCaseListResult {
  LoggerService.info(`${FILE_NAME}: useCaseList: hook invoked`);
  const fieldExecutive = useSessionStore((state) => state.fieldExecutive);
  const cache = useSyncExternalStore(CaseListCache.subscribe, CaseListCache.getSnapshot);
  const [selectedBucket, setSelectedBucket] = useState<CaseBucket>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [inFlight, setInFlight] = useState<TabRequests>({});
  const [failures, setFailures] = useState<TabRequests>({});
  const [acceptingCaseId, setAcceptingCaseId] = useState<string | null>(null);
  // Mirrors `inFlight` synchronously: the end-of-list trigger can fire again
  // before React re-renders, and must still see the request it just started.
  const inFlightRef = useRef<TabRequests>({});
  const requestSequenceRef = useRef(0);
  const countsRequestRef = useRef<number | null>(null);

  const updateInFlight = useCallback((update: (previous: TabRequests) => TabRequests): void => {
    LoggerService.info(`${FILE_NAME}: updateInFlight: updating in-flight requests`);
    inFlightRef.current = update(inFlightRef.current);
    setInFlight(inFlightRef.current);
  }, []);

  const loadCounts = useCallback((): void => {
    const generation = CaseListCache.supersedeCountsRequests();
    countsRequestRef.current = generation;
    LoggerService.info(`${FILE_NAME}: loadCounts: fetching`, { generation });
    fetchCaseCounts()
      .then((counts) => {
        const isStored = CaseListCache.storeCounts(generation, counts);
        LoggerService.info(`${FILE_NAME}: loadCounts: loaded`, { generation, isStored });
      })
      .catch((error: unknown) => {
        // Non-blocking: badges fall back to loaded counts / labels, and the next refresh retries.
        LoggerService.warn(`${FILE_NAME}: loadCounts: failed — badges fall back`, {
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      })
      .finally(() => {
        LoggerService.info(`${FILE_NAME}: loadCounts: settled`, { generation });
        if (countsRequestRef.current === generation) {
          countsRequestRef.current = null;
        }
      });
  }, []);

  const runPageRequest = useCallback(
    (bucket: CaseBucket, request: TabRequest, cursor: string | null): void => {
      LoggerService.info(`${FILE_NAME}: runPageRequest: fetching`, {
        bucket,
        kind: request.kind,
        requestId: request.requestId,
      });
      // Only the newest request for a tab may touch its status; a superseded one just lapses.
      const isLatest = (): boolean => inFlightRef.current[bucket]?.requestId === request.requestId;
      fetchCasesPage(bucket, cursor)
        .then((page) => {
          const isStored =
            request.kind === 'firstPage'
              ? CaseListCache.storeFirstPage(bucket, request.generation, page)
              : CaseListCache.appendNextPage(bucket, request.generation, page);
          LoggerService.info(`${FILE_NAME}: runPageRequest: loaded`, {
            bucket,
            kind: request.kind,
            count: page.items.length,
            isStored,
          });
        })
        .catch((error: unknown) => {
          LoggerService.error(`${FILE_NAME}: runPageRequest: failed`, {
            bucket,
            kind: request.kind,
            isLatest: isLatest(),
            reason: error instanceof Error ? error.message : 'unknown error',
          });
          if (isLatest()) {
            setFailures((previous) => ({ ...previous, [bucket]: request }));
          }
        })
        .finally(() => {
          LoggerService.info(`${FILE_NAME}: runPageRequest: settled`, {
            bucket,
            requestId: request.requestId,
          });
          if (isLatest()) {
            updateInFlight((previous) => withoutBucket(previous, bucket));
          }
        });
    },
    [updateInFlight],
  );

  /**
   * Starts a page request for `bucket` unless one is already in flight for its
   * current generation. A refresh supersedes whatever is in flight instead.
   */
  const loadTabPage = useCallback(
    (bucket: CaseBucket, kind: TabRequestKind, isRefresh: boolean): void => {
      const current = CaseListCache.getSnapshot();
      const cursor = kind === 'nextPage' ? current.tabs[bucket]?.nextCursor ?? null : null;
      LoggerService.info(`${FILE_NAME}: loadTabPage: requested`, {
        bucket,
        kind,
        isRefresh,
        hasCursor: cursor !== null,
      });
      if (kind === 'nextPage' && cursor === null) {
        LoggerService.info(`${FILE_NAME}: loadTabPage: no next page — skipped`, { bucket });
        return;
      }
      if (!isRefresh && selectCurrentRequest(inFlightRef.current, current, bucket) !== null) {
        LoggerService.info(`${FILE_NAME}: loadTabPage: request already in flight — skipped`, {
          bucket,
        });
        return;
      }
      const generation = isRefresh
        ? CaseListCache.supersedeTabRequests(bucket)
        : current.tabGenerations[bucket];
      requestSequenceRef.current += 1;
      const request: TabRequest = { requestId: requestSequenceRef.current, kind, generation };
      updateInFlight((previous) => ({ ...previous, [bucket]: request }));
      setFailures((previous) => withoutBucket(previous, bucket));
      runPageRequest(bucket, request, cursor);
    },
    [runPageRequest, updateInFlight],
  );

  const selectedTab = cache.tabs[selectedBucket];
  const isSelectedTabLoaded = selectedTab !== undefined;
  const selectedRequest = selectCurrentRequest(inFlight, cache, selectedBucket);
  const selectedFailure = selectCurrentRequest(failures, cache, selectedBucket);
  const isSelectedTabRequested = selectedRequest !== null;
  const hasSelectedTabFailed = selectedFailure !== null;

  useEffect(() => {
    // Counts are cached for the session like the tabs: only a refresh re-asks.
    if (CaseListCache.getSnapshot().counts !== null || countsRequestRef.current !== null) {
      LoggerService.info(`${FILE_NAME}: useCaseList: counts cached or in flight — not fetched`);
      return;
    }
    LoggerService.info(`${FILE_NAME}: useCaseList: initial counts effect running`);
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    // Lazy tabs: a tab's first page is requested when it is selected with
    // nothing cached, and never earlier. Also re-loads a selected tab that an
    // accept or outcome elsewhere just discarded.
    if (isSelectedTabLoaded || isSelectedTabRequested || hasSelectedTabFailed) {
      LoggerService.info(`${FILE_NAME}: useCaseList: lazy-load effect — nothing to load`, {
        selectedBucket,
        isSelectedTabLoaded,
        isSelectedTabRequested,
        hasSelectedTabFailed,
      });
      return;
    }
    LoggerService.info(`${FILE_NAME}: useCaseList: lazy-load effect — loading first page`, {
      selectedBucket,
    });
    loadTabPage(selectedBucket, 'firstPage', false);
  }, [
    hasSelectedTabFailed,
    isSelectedTabLoaded,
    isSelectedTabRequested,
    loadTabPage,
    selectedBucket,
  ]);

  const refresh = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: refresh: refresh requested`, { selectedBucket });
    CaseListCache.discardTabsExcept(selectedBucket);
    loadCounts();
    loadTabPage(selectedBucket, 'firstPage', true);
  }, [loadCounts, loadTabPage, selectedBucket]);

  const loadMore = useCallback((): void => {
    // After a failed next page the footer Retry takes over, so scrolling
    // doesn't keep re-firing a request that just failed.
    if (selectedFailure?.kind === 'nextPage') {
      LoggerService.info(`${FILE_NAME}: loadMore: waiting for footer retry — skipped`, {
        selectedBucket,
      });
      return;
    }
    LoggerService.info(`${FILE_NAME}: loadMore: end of list reached`, { selectedBucket });
    loadTabPage(selectedBucket, 'nextPage', false);
  }, [loadTabPage, selectedBucket, selectedFailure]);

  const retryLoadMore = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: retryLoadMore: retry pressed`, { selectedBucket });
    loadTabPage(selectedBucket, 'nextPage', false);
  }, [loadTabPage, selectedBucket]);

  const selectBucket = useCallback((bucket: CaseBucket): void => {
    LoggerService.info(`${FILE_NAME}: selectBucket: tab changed`, { bucket });
    setSelectedBucket(bucket);
  }, []);

  const bucketBadgeCounts = useMemo(() => resolveBadgeCounts(cache), [cache]);

  const visibleCases = useMemo(() => {
    const loadedCases = selectedTab?.items ?? [];
    LoggerService.info(`${FILE_NAME}: visibleCases: filtering cases`, {
      selectedBucket,
      loadedCount: loadedCases.length,
      searchQueryLength: searchQuery.trim().length,
    });
    const filtered = loadedCases.filter((item) => matchesSearch(item, searchQuery));
    LoggerService.info(`${FILE_NAME}: visibleCases: filtered`, {
      selectedBucket,
      visibleCount: filtered.length,
    });
    return filtered;
  }, [searchQuery, selectedBucket, selectedTab]);

  const acceptCase = useCallback((caseId: string): void => {
    LoggerService.info(`${FILE_NAME}: acceptCase: requested`, { caseId });
    setAcceptingCaseId(caseId);
    requestAcceptCase(caseId)
      .then(() => {
        LoggerService.info(`${FILE_NAME}: acceptCase: accepted — updating the list cache`, {
          caseId,
        });
        CaseListCache.applyCaseTransition(caseId, resolveAcceptTransition());
      })
      .catch((error: unknown) => {
        LoggerService.error(`${FILE_NAME}: acceptCase: failed`, {
          caseId,
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      })
      .finally(() => {
        LoggerService.info(`${FILE_NAME}: acceptCase: request settled`, { caseId });
        setAcceptingCaseId(null);
      });
  }, []);

  const hasFirstPageFailed = selectedFailure?.kind === 'firstPage';
  const isLoading = !isSelectedTabLoaded && !hasSelectedTabFailed;
  const isRefreshing = isSelectedTabLoaded && selectedRequest?.kind === 'firstPage';
  const loadError: CaseListLoadErrorKey | null =
    hasFirstPageFailed && !isSelectedTabLoaded ? 'network' : null;
  const refreshError: CaseListLoadErrorKey | null =
    hasFirstPageFailed && isSelectedTabLoaded ? 'network' : null;
  const isLoadingMore = selectedRequest?.kind === 'nextPage';
  const loadMoreError: CaseListLoadErrorKey | null =
    selectedFailure?.kind === 'nextPage' ? 'network' : null;

  LoggerService.info(`${FILE_NAME}: useCaseList: state`, {
    hasFieldExecutive: fieldExecutive !== null,
    selectedBucket,
    loadedCount: selectedTab?.items.length ?? 0,
    hasNextPage: selectedTab?.nextCursor != null,
    visibleCount: visibleCases.length,
    searchQueryLength: searchQuery.trim().length,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasLoadError: loadError !== null,
    hasRefreshError: refreshError !== null,
    hasLoadMoreError: loadMoreError !== null,
    isAccepting: acceptingCaseId !== null,
  });

  return {
    fieldExecutive,
    selectedBucket,
    selectBucket,
    bucketBadgeCounts,
    visibleCases,
    searchQuery,
    setSearchQuery,
    isLoading,
    isRefreshing,
    loadError,
    refreshError,
    refresh,
    isLoadingMore,
    loadMoreError,
    loadMore,
    retryLoadMore,
    acceptingCaseId,
    acceptCase,
  };
}
