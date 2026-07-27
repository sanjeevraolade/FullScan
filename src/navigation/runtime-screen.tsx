import React, { useCallback } from 'react';
import type { ReactElement } from 'react';
import { Box, Text } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import type { ScreenAction } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';
import type { VerificationRuntimeEngine } from '@/runtime/engine';
import { ScreenRenderer } from '@/runtime/renderer';

const FILE_NAME = 'runtime-screen.tsx';

export interface RuntimeScreenProps {
  readonly screenId: string;
  readonly runtimeEngine: VerificationRuntimeEngine;
}

/**
 * Hosts one configuration-driven screen inside a navigation route. Screens
 * are entirely config-driven (Dynamic Form Engine), so a single generic host
 * is enough here — there is no per-screen React component to author, only a
 * `screenId` to resolve through the Runtime Engine. `onAction` only logs for
 * now: deciding what happens next belongs to the Workflow Engine, which is
 * still a skeleton (see src/runtime/workflow/README.md).
 */
export function RuntimeScreen({ screenId, runtimeEngine }: RuntimeScreenProps): ReactElement {
  const { t } = useTranslation();
  LoggerService.info(`${FILE_NAME}: RuntimeScreen: resolving screen`, { screenId });
  const screen = runtimeEngine.getScreen(screenId);

  const handleAction = useCallback(
    (action: ScreenAction) => {
      LoggerService.info(
        `${FILE_NAME}: RuntimeScreen.handleAction: screen action triggered (Workflow Engine not implemented yet)`,
        { screenId, action },
      );
    },
    [screenId],
  );

  if (!screen) {
    LoggerService.error(`${FILE_NAME}: RuntimeScreen: screen missing from active configuration`, { screenId });
    return (
      <Box flex={1} alignItems="center" justifyContent="center" p="$4">
        <Text>{t('error.screenNotFound')}</Text>
      </Box>
    );
  }

  return (
    <Box flex={1} p="$4">
      <ScreenRenderer screen={screen} registry={runtimeEngine.getWidgetRegistry()} onAction={handleAction} />
    </Box>
  );
}
