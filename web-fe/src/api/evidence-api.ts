import { apiRequest, uploadFormData, type UploadOptions } from './client';
import { evidenceListSchema } from './schemas';
import type { EvidenceList } from '../types/evidence';

/** Multipart field name the server reads (`EVIDENCE_FIELD_NAME`). */
const EVIDENCE_FIELD_NAME = 'files';

function evidencePath(componentId: string): string {
  return `/cases/${encodeURIComponent(componentId)}/evidence`;
}

export const evidenceApi = {
  fetchEvidence(componentId: string, signal?: AbortSignal): Promise<EvidenceList> {
    return apiRequest(evidencePath(componentId), evidenceListSchema, { signal });
  },

  /** All-or-nothing on the server; answers with the component's full evidence list. */
  uploadEvidence(componentId: string, files: readonly File[], options?: UploadOptions): Promise<EvidenceList> {
    const formData = new FormData();
    for (const file of files) {
      formData.append(EVIDENCE_FIELD_NAME, file, file.name);
    }
    return uploadFormData(evidencePath(componentId), formData, evidenceListSchema, options);
  },
};
