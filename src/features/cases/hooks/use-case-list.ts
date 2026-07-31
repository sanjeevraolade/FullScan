import { useCallback, useEffect, useMemo, useState } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { acceptCase as requestAcceptCase, fetchCases } from '@/repositories/case-repository';
import { fetchCurrentFieldExecutive } from '@/repositories/field-executive-repository';
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
    return true;
  }
  return (
    candidate.caseRef.toLowerCase().includes(normalizedQuery) ||
    candidate.candidateName.toLowerCase().includes(normalizedQuery) ||
    candidate.clientName.toLowerCase().includes(normalizedQuery)
  );
}

function countByBucket(cases: Case[]): Record<CaseBucket, number> {
  const counts: Record<CaseBucket, number> = { new: 0, pending: 0, beyondTat: 0, completed: 0 };
  cases.forEach((item) => {
    counts[item.bucket] += 1;
  });
  return counts;
}

/**
 * Owns the case-list landing page's data: fetching the field executive
 * profile + assigned cases, tab/search filtering, and the Accept action.
 * Screens read from this hook only — no networking happens in the screen.
 */
export function useCaseList(): UseCaseListResult {
  const [fieldExecutive, setFieldExecutive] = useState<FieldExecutive | null>(null);
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
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);

    try {
      const [nextFieldExecutive, nextCases] = await Promise.all([
        fetchCurrentFieldExecutive(),
        fetchCases(),
      ]);
      setFieldExecutive(nextFieldExecutive);
      setCases(nextCases);
      LoggerService.info(`${FILE_NAME}: loadCaseList: loaded`, { count: nextCases.length });
    } catch (error: unknown) {
      LoggerService.error(`${FILE_NAME}: loadCaseList: failed`, {
        reason: error instanceof Error ? error.message : 'unknown error',
      });
      setLoadError('network');
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCaseList(false);
  }, [loadCaseList]);

  const refresh = useCallback((): void => {
    void loadCaseList(true);
  }, [loadCaseList]);

  const selectBucket = useCallback((bucket: CaseBucket): void => {
    LoggerService.info(`${FILE_NAME}: selectBucket: tab changed`, { bucket });
    setSelectedBucket(bucket);
  }, []);

  const bucketCounts = useMemo(() => countByBucket(cases), [cases]);

  const visibleCases = useMemo(
    () => cases.filter((item) => item.bucket === selectedBucket && matchesSearch(item, searchQuery)),
    [cases, selectedBucket, searchQuery],
  );

  const acceptCase = useCallback((caseId: string): void => {
    LoggerService.info(`${FILE_NAME}: acceptCase: requested`, { caseId });
    setAcceptingCaseId(caseId);
    requestAcceptCase(caseId)
      .then((updatedCase) => {
        setCases((previous) => previous.map((item) => (item.id === caseId ? updatedCase : item)));
      })
      .catch((error: unknown) => {
        LoggerService.error(`${FILE_NAME}: acceptCase: failed`, {
          caseId,
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      })
      .finally(() => {
        setAcceptingCaseId(null);
      });
  }, []);

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
