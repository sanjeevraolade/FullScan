import { create } from 'zustand';

import { LoggerService } from '@/infrastructure/logger';
import type { FieldExecutive } from '@/domain/field-executive';

const FILE_NAME = 'session.store.ts';

export interface SessionState {
  readonly fieldExecutive: FieldExecutive | null;
  setFieldExecutive: (fieldExecutive: FieldExecutive) => void;
  clearSession: () => void;
}

/**
 * App-wide session slice — the logged-in field executive's profile. Set once
 * right after login and read by any screen/drawer that needs to display it,
 * so it's fetched exactly once per session instead of per-screen.
 */
export const useSessionStore = create<SessionState>((set) => ({
  fieldExecutive: null,
  setFieldExecutive: (fieldExecutive: FieldExecutive): void => {
    LoggerService.info(`${FILE_NAME}: useSessionStore.setFieldExecutive: session established`, {
      fieldExecutiveId: fieldExecutive.id,
    });
    set({ fieldExecutive });
  },
  clearSession: (): void => {
    LoggerService.info(`${FILE_NAME}: useSessionStore.clearSession: clearing session`);
    set({ fieldExecutive: null });
  },
}));
