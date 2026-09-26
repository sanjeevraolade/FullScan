import { apiRequest } from './client';
import {
  adminUserListSchema,
  adminUserSummarySchema,
  createAdminUserResultSchema,
  deleteAdminUserResultSchema,
} from './schemas';
import type {
  AdminUserSummary,
  CreateAdminUserInput,
  CreateAdminUserResult,
  UpdateAdminUserInput,
} from '../types/admin-users';

function adminUserPath(adminUserId: string): string {
  return `/admin-users/${encodeURIComponent(adminUserId)}`;
}

export const adminUsersApi = {
  listAdminUsers(signal?: AbortSignal): Promise<readonly AdminUserSummary[]> {
    return apiRequest('/admin-users', adminUserListSchema, { signal });
  },

  createAdminUser(input: CreateAdminUserInput): Promise<CreateAdminUserResult> {
    return apiRequest('/admin-users', createAdminUserResultSchema, { method: 'POST', body: input });
  },

  updateAdminUser(adminUserId: string, changes: UpdateAdminUserInput): Promise<AdminUserSummary> {
    return apiRequest(adminUserPath(adminUserId), adminUserSummarySchema, { method: 'PATCH', body: changes });
  },

  async deleteAdminUser(adminUserId: string): Promise<void> {
    await apiRequest(adminUserPath(adminUserId), deleteAdminUserResultSchema, { method: 'DELETE' });
  },
};
