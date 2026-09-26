import { create } from 'zustand';
import { authApi } from '../api/auth-api';
import { ApiError } from '../api/client';
import type { AdminUser, AuthStatus, LoginCredentials } from '../types/auth';
import { useCaseListStore } from './case-list-store';
import { useReferenceStore } from './reference-store';

interface AuthState {
  readonly status: AuthStatus;
  readonly adminUser: AdminUser | null;

  /** Asks the server whether the session is still good, and re-reads the admin's role. */
  checkSession: () => Promise<void>;
  /** Throws `ApiError` on failure (wrong credentials, deactivated, rate limited, network). */
  login: (credentials: LoginCredentials) => Promise<AdminUser>;
  /** Throws when the server could not be reached — only the server can clear the cookie. */
  logout: () => Promise<void>;
  /** The session ended underneath the app (a 401). */
  expireSession: () => void;
}

/** Nothing one admin loaded may survive into another's session in the same tab. */
function clearUserData(): void {
  useCaseListStore.getState().reset();
  useReferenceStore.getState().reset();
}

let sessionCheck: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'checking',
  adminUser: null,

  checkSession: () => {
    if (!sessionCheck) {
      sessionCheck = authApi
        .fetchCurrentAdmin()
        .then((adminUser) => {
          set({ status: 'authenticated', adminUser });
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.isUnauthorized) {
            clearUserData();
            set({ status: 'anonymous', adminUser: null });
            return;
          }
          // A failed re-check of a live session keeps the admin signed in.
          if (get().status !== 'authenticated') {
            set({ status: 'unavailable', adminUser: null });
          }
        })
        .finally(() => {
          sessionCheck = null;
        });
    }
    return sessionCheck;
  },

  login: async (credentials) => {
    const { adminUser } = await authApi.login(credentials);
    clearUserData();
    set({ status: 'authenticated', adminUser });
    return adminUser;
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      if (!(error instanceof ApiError && error.isUnauthorized)) {
        throw error;
      }
    }
    clearUserData();
    set({ status: 'anonymous', adminUser: null });
  },

  expireSession: () => {
    clearUserData();
    set({ status: 'anonymous', adminUser: null });
  },
}));
