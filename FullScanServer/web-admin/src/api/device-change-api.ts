import { apiRequest } from './client';
import { deviceChangeRequestListSchema, deviceChangeRequestSchema } from './schemas';
import type {
  AdminDeviceChangeRequest,
  AdminDeviceChangeRequestList,
  DeviceChangeStatusFilter,
} from '../types/device-change';

function decisionPath(requestId: string, decision: 'approve' | 'reject'): string {
  return `/device-change-requests/${encodeURIComponent(requestId)}/${decision}`;
}

export const deviceChangeApi = {
  listRequests(status: DeviceChangeStatusFilter, signal?: AbortSignal): Promise<AdminDeviceChangeRequestList> {
    const query = status === 'all' ? '' : `?status=${status}`;
    return apiRequest(`/device-change-requests${query}`, deviceChangeRequestListSchema, { signal });
  },

  approve(requestId: string): Promise<AdminDeviceChangeRequest> {
    return apiRequest(decisionPath(requestId, 'approve'), deviceChangeRequestSchema, { method: 'POST', body: {} });
  },

  reject(requestId: string, note: string): Promise<AdminDeviceChangeRequest> {
    const body = note.trim() ? { note: note.trim() } : {};
    return apiRequest(decisionPath(requestId, 'reject'), deviceChangeRequestSchema, { method: 'POST', body });
  },
};
