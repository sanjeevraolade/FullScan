import { createContext, useContext } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import type { VerificationRuntimeEngine } from '@/runtime/engine';

const FILE_NAME = 'ApplicationContext.ts';

export const ApplicationContext = createContext<VerificationRuntimeEngine | undefined>(undefined);

export function useRuntimeEngine(): VerificationRuntimeEngine {
  const runtimeEngine = useContext(ApplicationContext);

  if (!runtimeEngine) {
    LoggerService.error(`${FILE_NAME}: useRuntimeEngine: called outside ApplicationProvider or before bootstrap completed`);
    throw new Error('useRuntimeEngine() must be used within ApplicationProvider, after bootstrap completes');
  }

  return runtimeEngine;
}
