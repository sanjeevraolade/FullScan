import { create } from 'zustand';
import { casesApi } from '../api/cases-api';
import { fieldExecutivesApi } from '../api/field-executives-api';
import { ApiError, isAbortError, toErrorMessage } from '../api/client';
import type { LoadStatus } from '../types/api';
import type { CaseFormOptions } from '../types/cases';
import type { AdminFieldExecutiveListItem } from '../types/field-executives';

/**
 * Reference data several pages share: the case editor's vocabularies (also the
 * source of status labels everywhere) and the full field executive roster (the
 * assignee options and the Cases page filter). Loaded once per session and
 * refreshable; pages call `ensureLoaded()`.
 */
interface ReferenceState {
  readonly formOptions: CaseFormOptions | null;
  readonly fieldExecutives: readonly AdminFieldExecutiveListItem[];
  readonly status: LoadStatus;
  readonly error: string | null;

  ensureLoaded: () => Promise<void>;
  reload: () => Promise<void>;
  reset: () => void;
}

let inFlight: Promise<void> | null = null;

export const useReferenceStore = create<ReferenceState>()((set, get) => {
  const load = (): Promise<void> => {
    if (inFlight) {
      return inFlight;
    }
    set({ status: 'loading', error: null });
    inFlight = Promise.all([casesApi.fetchFormOptions(), fieldExecutivesApi.listFieldExecutives()])
      .then(([formOptions, fieldExecutives]) => {
        set({ formOptions, fieldExecutives, status: 'success' });
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || (error instanceof ApiError && error.isUnauthorized)) {
          return;
        }
        set({ status: 'error', error: toErrorMessage(error, 'Could not load reference data.') });
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    formOptions: null,
    fieldExecutives: [],
    status: 'idle',
    error: null,

    ensureLoaded: () => (get().status === 'success' ? Promise.resolve() : load()),
    reload: load,
    reset: () => set({ formOptions: null, fieldExecutives: [], status: 'idle', error: null }),
  };
});
