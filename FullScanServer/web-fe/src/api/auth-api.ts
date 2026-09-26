import { apiRequest } from './client';
import { fieldExecutiveSchema, loginResultSchema, signOutResultSchema } from './schemas';
import type { FieldExecutive, LoginCredentials, LoginResult } from '../types/auth';

export const authApi = {
  /** Sets the httpOnly session cookie. The token is never in the response body. */
  login(credentials: LoginCredentials): Promise<LoginResult> {
    return apiRequest('/auth/login', loginResultSchema, {
      method: 'POST',
      body: credentials,
      isAuthRequest: true,
    });
  },

  /** 401 when there is no valid session — the caller treats that as "signed out". */
  fetchCurrentFieldExecutive(signal?: AbortSignal): Promise<FieldExecutive> {
    return apiRequest('/auth/me', fieldExecutiveSchema, { signal, isAuthRequest: true });
  },

  async logout(): Promise<void> {
    await apiRequest('/auth/logout', signOutResultSchema, { method: 'POST', isAuthRequest: true });
  },
};
