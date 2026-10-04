import React from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  AlertCircleIcon,
  AlertIcon,
  AlertText,
  Box,
  Button,
  ButtonText,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'case-list-error-notice.tsx';

export interface CaseListErrorNoticeProps {
  readonly messageKey: string;
  readonly onRetry: () => void;
  /**
   * `fullArea` fills the list area when there is nothing loaded to show;
   * `inline` sits above items that are still being shown.
   */
  readonly variant: 'fullArea' | 'inline';
  readonly testIDPrefix: string;
}

/** An error with a Retry button, rendered inside the case list's area so the tabs stay usable. */
export function CaseListErrorNotice({
  messageKey,
  onRetry,
  variant,
  testIDPrefix,
}: CaseListErrorNoticeProps): ReactElement {
  const { t } = useTranslation();

  LoggerService.info(`${FILE_NAME}: CaseListErrorNotice: rendering`, { messageKey, variant });

  const handleRetry = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListErrorNotice.handleRetry: retry pressed`, { variant });
    onRetry();
  };

  const notice = (
    <VStack space="md" alignItems={variant === 'fullArea' ? 'center' : 'stretch'}>
      <Alert action="error" testID={`${testIDPrefix}-alert`}>
        <AlertIcon as={AlertCircleIcon} mr="$2" />
        <AlertText flex={1}>{t(messageKey)}</AlertText>
      </Alert>
      <Button
        size={variant === 'fullArea' ? 'md' : 'sm'}
        variant={variant === 'fullArea' ? 'solid' : 'outline'}
        onPress={handleRetry}
        accessibilityLabel={t('caseList.actions.retry')}
        testID={`${testIDPrefix}-retry-button`}
      >
        <ButtonText>{t('caseList.actions.retry')}</ButtonText>
      </Button>
    </VStack>
  );

  if (variant === 'fullArea') {
    LoggerService.info(`${FILE_NAME}: CaseListErrorNotice: rendering full-area branch`);
    return (
      <Box flex={1} justifyContent="center" alignItems="center" p="$5">
        {notice}
      </Box>
    );
  }

  LoggerService.info(`${FILE_NAME}: CaseListErrorNotice: rendering inline branch`);
  return (
    <Box px="$4" pb="$2">
      {notice}
    </Box>
  );
}
