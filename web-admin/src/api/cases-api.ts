import { apiRequest } from './client';
import {
  caseDetailSchema,
  caseEvidenceListSchema,
  caseFormOptionsSchema,
  caseListResultSchema,
} from './schemas';
import type {
  AdminCaseDetail,
  AdminCaseEvidenceList,
  AdminCaseListResult,
  CaseFormOptions,
  CaseListFilter,
  CasePayload,
} from '../types/cases';

export const CASE_PAGE_SIZE = 25;

function casePath(caseId: string): string {
  return `/cases/${encodeURIComponent(caseId)}`;
}

export const casesApi = {
  listCases(filter: CaseListFilter, signal?: AbortSignal): Promise<AdminCaseListResult> {
    const params = new URLSearchParams({ limit: String(CASE_PAGE_SIZE), offset: String(filter.offset) });
    if (filter.bucket !== 'all') {
      params.set('bucket', filter.bucket);
    }
    if (filter.search.trim()) {
      params.set('search', filter.search.trim());
    }
    if (filter.fieldExecutiveId) {
      params.set('fieldExecutiveId', filter.fieldExecutiveId);
    }
    return apiRequest(`/cases?${params.toString()}`, caseListResultSchema, { signal });
  },

  fetchFormOptions(signal?: AbortSignal): Promise<CaseFormOptions> {
    return apiRequest('/cases/form-options', caseFormOptionsSchema, { signal });
  },

  fetchCase(caseId: string, signal?: AbortSignal): Promise<AdminCaseDetail> {
    return apiRequest(casePath(caseId), caseDetailSchema, { signal });
  },

  createCase(payload: CasePayload): Promise<AdminCaseDetail> {
    const components = payload.components.map((component) => {
      const { id: _ignored, ...withoutId } = component;
      return withoutId;
    });
    return apiRequest('/cases', caseDetailSchema, { method: 'POST', body: { ...payload, components } });
  },

  updateCase(caseId: string, payload: CasePayload): Promise<AdminCaseDetail> {
    return apiRequest(casePath(caseId), caseDetailSchema, { method: 'PUT', body: payload });
  },

  fetchCaseEvidence(caseId: string, signal?: AbortSignal): Promise<AdminCaseEvidenceList> {
    return apiRequest(`${casePath(caseId)}/evidence`, caseEvidenceListSchema, { signal });
  },
};

