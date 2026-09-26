import React, { useEffect, useState } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { Box, Spinner } from '@gluestack-ui/themed';

import { runBootstrap } from '@/bootstrap';
import { LoggerService } from '@/infrastructure/logger';
import { ThemeProvider } from '@/theme';

import { AppSafeArea } from './AppSafeArea';

const FILE_NAME = 'ApplicationProvider.tsx';

/**
 * Runs the Bootstrap Pipeline once on mount and only renders `children` once
 * it succeeds — screens can then assume theme and localization are ready.
 * `ThemeProvider` wraps both the loading and ready states so the loading
 * indicator itself is themed.
 */
export function ApplicationProvider({ children }: PropsWithChildren): ReactElement {
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(false);
  LoggerService.info(`${FILE_NAME}: ApplicationProvider: rendering`, { isBootstrapped });

  useEffect(() => {
    let isMounted = true;

    LoggerService.info(
      `${FILE_NAME}: ApplicationProvider: mount effect started, running bootstrap`,
    );
    runBootstrap()
      .then((result) => {
        if (!isMounted) {
          LoggerService.info(
            `${FILE_NAME}: ApplicationProvider: bootstrap resolved after unmount, ignoring`,
          );
          return;
        }
        if (result.success) {
          LoggerService.info(
            `${FILE_NAME}: ApplicationProvider: bootstrap succeeded, application ready`,
          );
          setIsBootstrapped(true);
        } else {
          LoggerService.error(`${FILE_NAME}: Bootstrap failed, application cannot start`, {
            failedStep: result.failedStep,
          });
        }
      })
      .catch((error: unknown) => {
        LoggerService.error(`${FILE_NAME}: Bootstrap threw unexpectedly`, { error: String(error) });
      });

    return () => {
      LoggerService.info(`${FILE_NAME}: ApplicationProvider: unmounting`);
      isMounted = false;
    };
  }, []);

  if (!isBootstrapped) {
    LoggerService.info(
      `${FILE_NAME}: ApplicationProvider: bootstrap not finished, rendering loading state`,
    );
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

  LoggerService.info(`${FILE_NAME}: ApplicationProvider: bootstrap complete, rendering children`);

  return <ThemeProvider>{children}</ThemeProvider>;
}
