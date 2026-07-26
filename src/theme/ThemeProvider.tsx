import React from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { GluestackUIProvider } from '@gluestack-ui/themed';

import { fullScanGluestackConfig } from './gluestack-ui.config';
import { ThemeEngine } from './theme-engine';

export function ThemeProvider({ children }: PropsWithChildren): ReactElement {
  return (
    <GluestackUIProvider config={fullScanGluestackConfig} colorMode={ThemeEngine.getResolvedMode()}>
      {children}
    </GluestackUIProvider>
  );
}
