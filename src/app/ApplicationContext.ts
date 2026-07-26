import { createContext, useContext } from 'react';

import type { VerificationRuntimeEngine } from '@/runtime/engine';

export const ApplicationContext = createContext<VerificationRuntimeEngine | undefined>(undefined);

export function useRuntimeEngine(): VerificationRuntimeEngine {
  const runtimeEngine = useContext(ApplicationContext);

  if (!runtimeEngine) {
    throw new Error('useRuntimeEngine() must be used within ApplicationProvider, after bootstrap completes');
  }

  return runtimeEngine;
}
