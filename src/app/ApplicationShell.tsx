import React from 'react';
import type { ReactElement } from 'react';
import { Box } from '@gluestack-ui/themed';

import type { ScreenAction } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';
import { ScreenRenderer } from '@/runtime/renderer';

import { useRuntimeEngine } from './ApplicationContext';
import { AppSafeArea } from './AppSafeArea';

/**
 * There is no Workflow Engine wired up yet (see src/runtime/workflow —
 * skeleton only), so which screen launches first is a fixed constant rather
 * than a workflow decision. The screen itself is still rendered entirely
 * from configuration.
 */
const LAUNCH_SCREEN_ID = 'login';

export function ApplicationShell(): ReactElement {
  const runtimeEngine = useRuntimeEngine();
  LoggerService.info('ApplicationShell: resolving launch screen', { screenId: LAUNCH_SCREEN_ID });
  const screen = runtimeEngine.getScreen(LAUNCH_SCREEN_ID);

  if (!screen) {
    LoggerService.error('Launch screen missing from active configuration', {
      screenId: LAUNCH_SCREEN_ID,
    });
    return (
      <AppSafeArea>
        <Box flex={1} />
      </AppSafeArea>
    );
  }

  const handleAction = (action: ScreenAction): void => {
    LoggerService.info('ApplicationShell.handleAction: screen action triggered (Workflow Engine not implemented yet)', { action });
  };

  return (
    <AppSafeArea>
      <Box flex={1} p="$4">
        <ScreenRenderer screen={screen} registry={runtimeEngine.getWidgetRegistry()} onAction={handleAction} />
      </Box>
    </AppSafeArea>
  );
}
