import React from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { GluestackUIProvider } from '@gluestack-ui/themed';

import { LoggerService } from '@/infrastructure/logger';

import { fullScanGluestackConfig } from './gluestack-ui.config';
import { ThemeEngine } from './theme-engine';

const FILE_NAME = 'ThemeProvider.tsx';

export function ThemeProvider({ children }: PropsWithChildren): ReactElement {
  const resolvedMode = ThemeEngine.getResolvedMode();
  LoggerService.info(`${FILE_NAME}: ThemeProvider: rendering`, { resolvedMode });

  return (
    <GluestackUIProvider config={fullScanGluestackConfig} colorMode={resolvedMode}>
      {children}
    </GluestackUIProvider>
  );
}
