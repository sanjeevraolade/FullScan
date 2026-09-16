import { create } from 'zustand';
import { authApi } from '../api/auth-api';
import { ApiError } from '../api/client';
import type { AuthStatus, FieldExecutive, LoginCredentials } from '../types/auth';
import { useAssignmentStore } from './assignment-store';
import { useEvidenceStore } from './evidence-store';

interface AuthState {
  readonly status: AuthStatus;
  readonly fieldExecutive: FieldExecutive | null;

  /** Asks the server whether the session cookie is still good. */
  checkSession: () => Promise<void>;
  /** Throws `ApiError` on failure (wrong credentials, rate limit, network). */
  login: (credentials: LoginCredentials) => Promise<FieldExecutive>;
  /** Throws when the server could not be reached — the cookie can only be cleared by the server. */
  logout: () => Promise<void>;
  /** The session ended underneath the app (a 401): forget everything user-specific. */
  expireSession: () => void;
}

/** Nothing one executive loaded may survive into another's session in the same tab. */
function clearUserData(): void {
  useAssignmentStore.getState().reset();
  useEvidenceStore.getState().reset();
}

let sessionCheck: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'checking',
  fieldExecutive: null,

  checkSession: () => {
    if (!sessionCheck) {
      sessionCheck = authApi
        .fetchCurrentFieldExecutive()
        .then((fieldExecutive) => {
          set({ status: 'authenticated', fieldExecutive });
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.isUnauthorized) {
            clearUserData();
            set({ status: 'anonymous', fieldExecutive: null });
            return;
          }
          set({ status: 'unavailable', fieldExecutive: null });
        })
        .finally(() => {
          sessionCheck = null;
        });
    }
    return sessionCheck;
  },

  login: async (credentials) => {
    const { fieldExecutive } = await authApi.login(credentials);
    clearUserData();
    set({ status: 'authenticated', fieldExecutive });
    return fieldExecutive;
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // No session left to end is still a successful sign-out.
      if (!(error instanceof ApiError && error.isUnauthorized)) {
        throw error;
      }
    }
    clearUserData();
    set({ status: 'anonymous', fieldExecutive: null });
  },

  expireSession: () => {
    clearUserData();
    set({ status: 'anonymous', fieldExecutive: null });
  },
}));
