import { create } from 'zustand';

import { LoggerService } from '@/infrastructure/logger';
import type { ReferenceData } from '@/domain/reference-data';

const FILE_NAME = 'reference-data.store.ts';

export interface ReferenceDataState {
  readonly referenceData: ReferenceData | null;
  setReferenceData: (referenceData: ReferenceData) => void;
  clearReferenceData: () => void;
}

/**
 * App-wide dropdown/option data (verification statuses, UTV/Insufficient
 * reasons, photo types) — fetched once right after login, alongside the
 * field executive profile, and read by any screen that needs an option
 * list instead of re-fetching per screen.
 */
export const useReferenceDataStore = create<ReferenceDataState>((set) => ({
  referenceData: null,
  setReferenceData: (referenceData: ReferenceData): void => {
    LoggerService.info(`${FILE_NAME}: useReferenceDataStore.setReferenceData: reference data set`);
    set({ referenceData });
  },
  clearReferenceData: (): void => {
    LoggerService.info(`${FILE_NAME}: useReferenceDataStore.clearReferenceData: clearing reference data`);
    set({ referenceData: null });
  },
}));
