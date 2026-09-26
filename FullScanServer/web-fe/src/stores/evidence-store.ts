import { create } from 'zustand';
import { evidenceApi } from '../api/evidence-api';
import { ApiError, isAbortError, toErrorMessage } from '../api/client';
import type { LoadStatus } from '../types/api';
import type { Evidence, UploadProgress } from '../types/evidence';

export interface ComponentEvidence {
  readonly items: readonly Evidence[];
  readonly status: LoadStatus;
  readonly error: string | null;
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface EvidenceUpload {
  readonly status: UploadStatus;
  readonly progress: UploadProgress | null;
  readonly error: string | null;
  /** How many files the last successful upload stored. */
  readonly uploadedCount: number;
}

export const EMPTY_COMPONENT_EVIDENCE: ComponentEvidence = { items: [], status: 'idle', error: null };
export const IDLE_UPLOAD: EvidenceUpload = { status: 'idle', progress: null, error: null, uploadedCount: 0 };

/**
 * Evidence lists and upload state, keyed by the assignment's component id, so an
 * upload stays tied to the assignment it was started on even if the executive
 * navigates to another one while it runs.
 */
interface EvidenceState {
  readonly byComponent: Readonly<Record<string, ComponentEvidence>>;
  readonly uploads: Readonly<Record<string, EvidenceUpload>>;

  fetchEvidence: (componentId: string) => Promise<void>;
  /** Resolves true when every file was stored. */
  uploadEvidence: (componentId: string, files: readonly File[]) => Promise<boolean>;
  cancelUpload: (componentId: string) => void;
  dismissUpload: (componentId: string) => void;
  reset: () => void;
}

const fetchControllers = new Map<string, AbortController>();
const uploadControllers = new Map<string, AbortController>();

function isSessionEnd(error: unknown): boolean {
  return error instanceof ApiError && error.isUnauthorized;
}

export const useEvidenceStore = create<EvidenceState>()((set, get) => {
  const patchEvidence = (componentId: string, changes: Partial<ComponentEvidence>): void => {
    const current = get().byComponent[componentId] ?? EMPTY_COMPONENT_EVIDENCE;
    set({ byComponent: { ...get().byComponent, [componentId]: { ...current, ...changes } } });
  };

  const patchUpload = (componentId: string, changes: Partial<EvidenceUpload>): void => {
    const current = get().uploads[componentId] ?? IDLE_UPLOAD;
    set({ uploads: { ...get().uploads, [componentId]: { ...current, ...changes } } });
  };

  return {
    byComponent: {},
    uploads: {},

    fetchEvidence: async (componentId) => {
      fetchControllers.get(componentId)?.abort();
      const controller = new AbortController();
      fetchControllers.set(componentId, controller);

      patchEvidence(componentId, { status: 'loading', error: null });

      try {
        const { evidence } = await evidenceApi.fetchEvidence(componentId, controller.signal);
        patchEvidence(componentId, { items: evidence, status: 'success' });
      } catch (error) {
        if (isAbortError(error) || isSessionEnd(error)) {
          return;
        }
        patchEvidence(componentId, {
          status: 'error',
          error: toErrorMessage(error, 'Could not load uploaded evidence.'),
        });
      } finally {
        if (fetchControllers.get(componentId) === controller) {
          fetchControllers.delete(componentId);
        }
      }
    },

    uploadEvidence: async (componentId, files) => {
      if (uploadControllers.has(componentId)) {
        return false;
      }

      const controller = new AbortController();
      uploadControllers.set(componentId, controller);
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

      patchUpload(componentId, {
        status: 'uploading',
        error: null,
        uploadedCount: 0,
        progress: { loadedBytes: 0, totalBytes, percent: 0 },
      });

      try {
        const { evidence } = await evidenceApi.uploadEvidence(componentId, files, {
          signal: controller.signal,
          onProgress: (loadedBytes, total) => {
            patchUpload(componentId, {
              progress: {
                loadedBytes,
                totalBytes: total,
                percent: total > 0 ? Math.min(100, Math.round((loadedBytes / total) * 100)) : 0,
              },
            });
          },
        });

        // A successful upload answers with the full list, so it replaces any in-flight fetch.
        fetchControllers.get(componentId)?.abort();
        patchEvidence(componentId, { items: evidence, status: 'success', error: null });
        patchUpload(componentId, { status: 'success', uploadedCount: files.length });
        return true;
      } catch (error) {
        if (isSessionEnd(error)) {
          return false;
        }
        patchUpload(componentId, {
          status: 'error',
          progress: null,
          error: isAbortError(error) ? 'Upload cancelled. Nothing was saved.' : toErrorMessage(error, 'Upload failed.'),
        });
        return false;
      } finally {
        uploadControllers.delete(componentId);
      }
    },

    cancelUpload: (componentId) => {
      uploadControllers.get(componentId)?.abort();
    },

    dismissUpload: (componentId) => {
      if (uploadControllers.has(componentId)) {
        return;
      }
      patchUpload(componentId, IDLE_UPLOAD);
    },

    reset: () => {
      for (const controller of [...fetchControllers.values(), ...uploadControllers.values()]) {
        controller.abort();
      }
      fetchControllers.clear();
      uploadControllers.clear();
      set({ byComponent: {}, uploads: {} });
    },
  };
});
