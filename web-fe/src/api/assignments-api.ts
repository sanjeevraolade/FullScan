import { apiRequest } from './client';
import { assignmentDetailSchema, assignmentListSchema } from './schemas';
import type { AssignmentDetail, AssignmentList } from '../types/assignment';

export const assignmentsApi = {
  fetchAssignments(signal?: AbortSignal): Promise<AssignmentList> {
    return apiRequest('/cases', assignmentListSchema, { signal });
  },

  fetchAssignment(componentId: string, signal?: AbortSignal): Promise<AssignmentDetail> {
    return apiRequest(`/cases/${encodeURIComponent(componentId)}`, assignmentDetailSchema, { signal });
  },
};
