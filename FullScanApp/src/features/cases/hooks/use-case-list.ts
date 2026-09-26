import { useCallback, useEffect, useMemo, useState } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { acceptCase as requestAcceptCase, fetchCases } from '@/repositories/case-repository';
import { useSessionStore } from '@/store/session';
import type { Case, CaseBucket } from '@/domain/case';
import type { FieldExecutive } from '@/domain/field-executive';

const FILE_NAME = 'use-case-list.ts';

/** Tab order for the case list — Completed is spec'd but shown last. */
export const CASE_LIST_BUCKETS: readonly CaseBucket[] = ['new', 'pending', 'beyondTat', 'completed'];

export type CaseListLoadErrorKey = 'network';

export interface UseCaseListResult {
  readonly fieldExecutive: FieldExecutive | null;
  readonly selectedBucket: CaseBucket;
  readonly selectBucket: (bucket: CaseBucket) => void;
  readonly bucketCounts: Record<CaseBucket, number>;
  readonly visibleCases: Case[];
  readonly searchQuery: string;
  readonly setSearchQuery: (query: string) => void;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly loadError: CaseListLoadErrorKey | null;
  readonly refresh: () => void;
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

function countByBucket(cases: Case[]): Record<CaseBucket, number> {
  LoggerService.info(`${FILE_NAME}: countByBucket: counting cases per bucket`, {
    count: cases.length,
  });
  const counts: Record<CaseBucket, number> = { new: 0, pending: 0, beyondTat: 0, completed: 0 };
  cases.forEach((item) => {
    counts[item.bucket] += 1;
  });
  LoggerService.info(`${FILE_NAME}: countByBucket: counted`, {
    new: counts.new,
    pending: counts.pending,
    beyondTat: counts.beyondTat,
    completed: counts.completed,
  });
  return counts;
}

/**
 * Owns the case-list landing page's data: the assigned cases (tab/search
 * filtering, the Accept action) plus the field executive identity read from
 * the session store — already populated at login, so it isn't re-fetched
 * here. Screens read from this hook only — no networking happens in the
 * screen.
 */
export function useCaseList(): UseCaseListResult {
  LoggerService.info(`${FILE_NAME}: useCaseList: hook invoked`);
  const fieldExecutive = useSessionStore((state) => state.fieldExecutive);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<CaseBucket>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<CaseListLoadErrorKey | null>(null);
  const [acceptingCaseId, setAcceptingCaseId] = useState<string | null>(null);

  const loadCaseList = useCallback(async (isRefresh: boolean): Promise<void> => {
    LoggerService.info(`${FILE_NAME}: loadCaseList: fetching`, { isRefresh });
    if (isRefresh) {
      LoggerService.info(`${FILE_NAME}: loadCaseList: pull-to-refresh in progress`);
      setIsRefreshing(true);
    } else {
      LoggerService.info(`${FILE_NAME}: loadCaseList: initial load in progress`);
      setIsLoading(true);
    }
    setLoadError(null);

    try {
      const nextCases = await fetchCases();
      setCases(nextCases);
      LoggerService.info(`${FILE_NAME}: loadCaseList: loaded`, { count: nextCases.length });
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: loadCaseList: failed`, {
        reason: error instanceof Error ? error.message : 'unknown error',
      });
      setLoadError('network');
    } finally {
      LoggerService.info(`${FILE_NAME}: loadCaseList: fetch settled`, { isRefresh });
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: useCaseList: initial load effect running`);
    void loadCaseList(false);
  }, [loadCaseList]);

  const refresh = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: refresh: refresh requested`);
    void loadCaseList(true);
  }, [loadCaseList]);

  const selectBucket = useCallback((bucket: CaseBucket): void => {
    LoggerService.info(`${FILE_NAME}: selectBucket: tab changed`, { bucket });
    setSelectedBucket(bucket);
  }, []);

  const bucketCounts = useMemo(() => {
    LoggerService.info(`${FILE_NAME}: bucketCounts: recomputing tab counts`, {
      count: cases.length,
    });
    return countByBucket(cases);
  }, [cases]);

  const visibleCases = useMemo(() => {
    LoggerService.info(`${FILE_NAME}: visibleCases: filtering cases`, {
      count: cases.length,
      selectedBucket,
      searchQueryLength: searchQuery.trim().length,
    });
    const filtered = cases.filter(
      (item) => item.bucket === selectedBucket && matchesSearch(item, searchQuery),
    );
    LoggerService.info(`${FILE_NAME}: visibleCases: filtered`, {
      selectedBucket,
      visibleCount: filtered.length,
    });
    return filtered;
  }, [cases, selectedBucket, searchQuery]);

  const acceptCase = useCallback((caseId: string): void => {
    LoggerService.info(`${FILE_NAME}: acceptCase: requested`, { caseId });
    setAcceptingCaseId(caseId);
    requestAcceptCase(caseId)
      .then((updatedCase) => {
        LoggerService.info(`${FILE_NAME}: acceptCase: accepted — replacing case in list`, {
          caseId,
          bucket: updatedCase.bucket,
        });
        setCases((previous) => previous.map((item) => (item.id === caseId ? updatedCase : item)));
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

  LoggerService.info(`${FILE_NAME}: useCaseList: state`, {
    hasFieldExecutive: fieldExecutive !== null,
    selectedBucket,
    caseCount: cases.length,
    visibleCount: visibleCases.length,
    searchQueryLength: searchQuery.trim().length,
    isLoading,
    isRefreshing,
    hasLoadError: loadError !== null,
    isAccepting: acceptingCaseId !== null,
  });

  return {
    fieldExecutive,
    selectedBucket,
    selectBucket,
    bucketCounts,
    visibleCases,
    searchQuery,
    setSearchQuery,
    isLoading,
    isRefreshing,
    loadError,
    refresh,
    acceptingCaseId,
    acceptCase,
  };
}
