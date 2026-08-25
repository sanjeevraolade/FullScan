import React from 'react';
import type { ReactElement } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { RootNavigator } from '@/navigation';

import { AppSafeArea } from './AppSafeArea';

const FILE_NAME = 'ApplicationShell.tsx';

/**
 * Composes the app shell: safe area + the navigation stack (screen
 * registration/route typing lives in src/navigation, per
 * fullscan-navigation). Login is the stack's initial route — see
 * src/navigation/root-navigator.tsx for why it's the only route so far.
 *
 * Excludes the `top` edge: React Navigation's native stack/drawer headers
 * already consume the top safe-area inset for screens that have one
 * (Case List, Case Details); reserving it here too would double-pad them.
 * Login has no native header, so it applies its own top inset directly.
 */
export function ApplicationShell(): ReactElement {
  LoggerService.info(`${FILE_NAME}: ApplicationShell: rendering root navigator`);

  return (
    <AppSafeArea edges={['left', 'right', 'bottom']}>
      <RootNavigator />
    </AppSafeArea>
  );
}
