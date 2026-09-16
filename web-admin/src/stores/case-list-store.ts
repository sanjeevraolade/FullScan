import { create } from 'zustand';
import { casesApi } from '../api/cases-api';
import { ApiError, isAbortError, toErrorMessage } from '../api/client';
import type { LoadStatus } from '../types/api';
import type { AdminCaseListResult, CaseListFilter } from '../types/cases';

export const DEFAULT_CASE_FILTER: CaseListFilter = { bucket: 'all', search: '', fieldExecutiveId: '', offset: 0 };

/**
 * The Cases list: filter, page and result. Kept in a store so returning from the
 * editor lands on the same tab, search and page the admin left.
 */
interface CaseListState {
  readonly filter: CaseListFilter;
  readonly result: AdminCaseListResult | null;
  readonly status: LoadStatus;
  readonly error: string | null;

  /** Applies filter changes. Any change other than `offset` returns to the first page. */
  setFilter: (changes: Partial<CaseListFilter>) => void;
  fetchCases: () => Promise<void>;
  reset: () => void;
}

let controller: AbortController | null = null;

export const useCaseListStore = create<CaseListState>()((set, get) => ({
  filter: DEFAULT_CASE_FILTER,
  result: null,
  status: 'idle',
  error: null,

  setFilter: (changes) => {
    const isPaging = Object.keys(changes).every((key) => key === 'offset');
    set({ filter: { ...get().filter, ...changes, ...(isPaging ? {} : { offset: 0 }) } });
  },

  fetchCases: async () => {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    set({ status: 'loading', error: null });

    try {
      const result = await casesApi.listCases(get().filter, current.signal);
      set({ result, status: 'success' });
    } catch (error) {
      if (isAbortError(error) || (error instanceof ApiError && error.isUnauthorized)) {
        return;
      }
      set({ status: 'error', error: toErrorMessage(error, 'Could not load cases.') });
    } finally {
      if (controller === current) {
        controller = null;
      }
    }
  },

  reset: () => {
    controller?.abort();
    controller = null;
    set({ filter: DEFAULT_CASE_FILTER, result: null, status: 'idle', error: null });
  },
}));
