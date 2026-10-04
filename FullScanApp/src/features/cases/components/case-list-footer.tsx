import React from 'react';
import type { ReactElement } from 'react';
import { Box, Spinner } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

import { CaseListErrorNotice } from './case-list-error-notice';

const FILE_NAME = 'case-list-footer.tsx';

export interface CaseListFooterProps {
  readonly isLoadingMore: boolean;
  readonly hasLoadMoreError: boolean;
  readonly onRetry: () => void;
}

/**
 * Below the last loaded case: a spinner while the next page loads, or an
 * inline Retry when it failed. The cases above it stay on screen either way.
 */
export function CaseListFooter({
  isLoadingMore,
  hasLoadMoreError,
  onRetry,
}: CaseListFooterProps): ReactElement | null {
  const { t } = useTranslation();

  LoggerService.info(`${FILE_NAME}: CaseListFooter: rendering`, {
    isLoadingMore,
    hasLoadMoreError,
  });

  if (isLoadingMore) {
    LoggerService.info(`${FILE_NAME}: CaseListFooter: rendering loading branch`);
    return (
      <Box py="$4" alignItems="center">
        <Spinner
          size="small"
          accessibilityLabel={t('caseList.loadMore.loading')}
          testID="case-list-load-more-spinner"
        />
      </Box>
    );
  }

  if (hasLoadMoreError) {
    LoggerService.warn(`${FILE_NAME}: CaseListFooter: rendering retry branch`);
    return (
      <Box pt="$2" pb="$4">
        <CaseListErrorNotice
          messageKey="caseList.loadMore.error"
          onRetry={onRetry}
          variant="inline"
          testIDPrefix="case-list-load-more"
        />
      </Box>
    );
  }

  LoggerService.info(`${FILE_NAME}: CaseListFooter: nothing to show`);
  return null;
}
