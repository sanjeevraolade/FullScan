import { apiRequest } from './client';
import { fieldExecutiveHistorySchema, fieldExecutiveListSchema } from './schemas';
import type { AdminFieldExecutiveListItem, FieldExecutiveHistory } from '../types/field-executives';

export const fieldExecutivesApi = {
  listFieldExecutives(search = '', signal?: AbortSignal): Promise<readonly AdminFieldExecutiveListItem[]> {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    return apiRequest(`/field-executives${query}`, fieldExecutiveListSchema, { signal });
  },

  fetchHistory(fieldExecutiveId: string, signal?: AbortSignal): Promise<FieldExecutiveHistory> {
    return apiRequest(
      `/field-executives/${encodeURIComponent(fieldExecutiveId)}/history`,
      fieldExecutiveHistorySchema,
      { signal },
    );
  },
};
