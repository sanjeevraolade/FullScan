import { apiRequest } from './client';
import { adminUserSchema, loginResultSchema, signOutResultSchema } from './schemas';
import type { AdminUser, LoginCredentials, LoginResult } from '../types/auth';

export const authApi = {
  /** Sets the httpOnly session cookie. The token in the body (for Bearer clients) is ignored. */
  login(credentials: LoginCredentials): Promise<LoginResult> {
    return apiRequest('/auth/login', loginResultSchema, { method: 'POST', body: credentials, isAuthRequest: true });
  },

  fetchCurrentAdmin(signal?: AbortSignal): Promise<AdminUser> {
    return apiRequest('/auth/me', adminUserSchema, { signal, isAuthRequest: true });
  },

  async logout(): Promise<void> {
    await apiRequest('/auth/logout', signOutResultSchema, { method: 'POST', isAuthRequest: true });
  },
};
