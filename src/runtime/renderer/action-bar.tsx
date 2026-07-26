import React from 'react';
import type { ReactElement } from 'react';
import { Button, ButtonText, HStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import type { ScreenAction } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

export interface ActionBarProps {
  readonly screenId: string;
  readonly actions: readonly ScreenAction[];
  readonly onAction?: ((action: ScreenAction) => void) | undefined;
}

/**
 * The Screen Schema (docs/06-Contracts/03-Screen-Schema.md §8) only lists
 * action verbs (submit/cancel/...), not per-action label keys, so labels are
 * resolved by convention: `${screenId}.actions.${action}`. Revisit this if
 * the schema grows a real labelKey per action.
 */
export function ActionBar({ screenId, actions, onAction }: ActionBarProps): ReactElement | null {
  const { t } = useTranslation();

  if (actions.length === 0) {
    LoggerService.info('ActionBar: no actions declared, rendering nothing', { screenId });
    return null;
  }

  return (
    <HStack space="md">
      {actions.map((action) => (
        <Button
          key={action}
          flex={1}
          onPress={() => {
            LoggerService.info('ActionBar: action pressed', { screenId, action });
            onAction?.(action);
          }}
        >
          <ButtonText>{t(`${screenId}.actions.${action}`)}</ButtonText>
        </Button>
      ))}
    </HStack>
  );
}
