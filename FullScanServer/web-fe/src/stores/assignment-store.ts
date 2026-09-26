import { create } from 'zustand';
import { assignmentsApi } from '../api/assignments-api';
import { ApiError, isAbortError, toErrorMessage } from '../api/client';
import type { LoadStatus } from '../types/api';
import type { AssignmentDetail, AssignmentFilter, AssignmentGroup } from '../types/assignment';

export const DEFAULT_ASSIGNMENT_FILTER: AssignmentFilter = { bucket: 'all', query: '' };

interface AssignmentState {
  readonly groups: readonly AssignmentGroup[];
  readonly listStatus: LoadStatus;
  readonly listError: string | null;
  /** Epoch ms of the last successful list load. */
  readonly listLoadedAt: number | null;

  readonly filter: AssignmentFilter;

  readonly selectedId: string | null;
  readonly detail: AssignmentDetail | null;
  readonly detailStatus: LoadStatus;
  readonly detailError: string | null;

  fetchAssignments: () => Promise<void>;
  setFilter: (changes: Partial<AssignmentFilter>) => void;
  selectAssignment: (componentId: string) => Promise<void>;
  clearSelection: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  groups: [],
  listStatus: 'idle',
  listError: null,
  listLoadedAt: null,
  filter: DEFAULT_ASSIGNMENT_FILTER,
  selectedId: null,
  detail: null,
  detailStatus: 'idle',
  detailError: null,
} as const satisfies Partial<AssignmentState>;

/** In-flight requests. Starting a newer request cancels the older one, so a slow stale answer can never win. */
let listController: AbortController | null = null;
let detailController: AbortController | null = null;

/** A 401 has already signed the app out (and reset this store) — there is nothing to show. */
function isSessionEnd(error: unknown): boolean {
  return error instanceof ApiError && error.isUnauthorized;
}

export const useAssignmentStore = create<AssignmentState>()((set, get) => ({
  ...INITIAL_STATE,

  fetchAssignments: async () => {
    listController?.abort();
    const controller = new AbortController();
    listController = controller;

    set({ listStatus: 'loading', listError: null });

    try {
      const { caseGroups } = await assignmentsApi.fetchAssignments(controller.signal);
      set({ groups: caseGroups, listStatus: 'success', listLoadedAt: Date.now() });
    } catch (error) {
      if (isAbortError(error) || isSessionEnd(error)) {
        return;
      }
      set({ listStatus: 'error', listError: toErrorMessage(error, 'Could not load your assignments.') });
    } finally {
      if (listController === controller) {
        listController = null;
      }
    }
  },

  setFilter: (changes) => {
    set({ filter: { ...get().filter, ...changes } });
  },

  selectAssignment: async (componentId) => {
    detailController?.abort();
    const controller = new AbortController();
    detailController = controller;

    // Keep showing the current detail while it refreshes; clear it when switching assignments.
    const isSameAssignment = get().detail?.componentId === componentId;
    set({
      selectedId: componentId,
      detailStatus: 'loading',
      detailError: null,
      ...(isSameAssignment ? {} : { detail: null }),
    });

    try {
      const detail = await assignmentsApi.fetchAssignment(componentId, controller.signal);
      set({ detail, detailStatus: 'success' });
    } catch (error) {
      if (isAbortError(error) || isSessionEnd(error)) {
        return;
      }
      const message =
        error instanceof ApiError && error.status === 404
          ? 'This assignment does not exist or is not assigned to you.'
          : toErrorMessage(error, 'Could not load this assignment.');
      set({ detail: null, detailStatus: 'error', detailError: message });
    } finally {
      if (detailController === controller) {
        detailController = null;
      }
    }
  },

  clearSelection: () => {
    detailController?.abort();
    detailController = null;
    set({ selectedId: null, detail: null, detailStatus: 'idle', detailError: null });
  },

  reset: () => {
    listController?.abort();
    detailController?.abort();
    listController = null;
    detailController = null;
    set(INITIAL_STATE);
  },
}));
