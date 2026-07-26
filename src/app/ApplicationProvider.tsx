import React, { useEffect, useState } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { Box, Spinner } from '@gluestack-ui/themed';

import { runBootstrap } from '@/bootstrap';
import { LoggerService } from '@/infrastructure/logger';
import type { VerificationRuntimeEngine } from '@/runtime/engine';
import { ThemeProvider } from '@/theme';

import { ApplicationContext } from './ApplicationContext';
import { AppSafeArea } from './AppSafeArea';

/**
 * Runs the Bootstrap Pipeline once on mount and only renders `children` once
 * it succeeds. `ThemeProvider` wraps both the loading and ready states so
 * the loading indicator itself is themed.
 */
export function ApplicationProvider({ children }: PropsWithChildren): ReactElement {
  const [runtimeEngine, setRuntimeEngine] = useState<VerificationRuntimeEngine | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    runBootstrap()
      .then((result) => {
        if (!isMounted) {
          return;
        }
        if (result.success) {
          setRuntimeEngine(result.context.runtimeEngine);
        } else {
          LoggerService.error('Bootstrap failed, application cannot start', {
            failedStep: result.failedStep,
          });
        }
      })
      .catch((error: unknown) => {
        LoggerService.error('Bootstrap threw unexpectedly', { error: String(error) });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!runtimeEngine) {
    return (
      <ThemeProvider>
        <AppSafeArea>
          <Box flex={1} alignItems="center" justifyContent="center">
            <Spinner />
          </Box>
        </AppSafeArea>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ApplicationContext.Provider value={runtimeEngine}>{children}</ApplicationContext.Provider>
    </ThemeProvider>
  );
}
