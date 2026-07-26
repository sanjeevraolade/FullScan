import { createContext, useContext } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import type { VerificationRuntimeEngine } from '@/runtime/engine';

export const ApplicationContext = createContext<VerificationRuntimeEngine | undefined>(undefined);

export function useRuntimeEngine(): VerificationRuntimeEngine {
  const runtimeEngine = useContext(ApplicationContext);

  if (!runtimeEngine) {
    LoggerService.error('useRuntimeEngine: called outside ApplicationProvider or before bootstrap completed');
    throw new Error('useRuntimeEngine() must be used within ApplicationProvider, after bootstrap completes');
  }

  return runtimeEngine;
}
