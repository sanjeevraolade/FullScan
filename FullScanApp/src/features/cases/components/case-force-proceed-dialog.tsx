import React from 'react';
import type { ReactElement } from 'react';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertIcon,
  AlertCircleIcon,
  Box,
  Button,
  ButtonText,
  CloseIcon,
  HStack,
  Heading,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'case-force-proceed-dialog.tsx';

export interface CaseForceProceedDialogProps {
  readonly isOpen: boolean;
  readonly onCancel: () => void;
  readonly onAgree: () => void;
}

/**
 * The red consent dialog behind "Proceed Without Distance".
 *
 * Its whole job is to make sure the bypass is a deliberate, informed act: it
 * states plainly that the case will be scrutinized after submission, and
 * nothing is unlocked until the user picks Agree. Cancel leaves the case
 * blocked exactly as it was.
 */
export function CaseForceProceedDialog({
  isOpen,
  onCancel,
  onAgree,
}: CaseForceProceedDialogProps): ReactElement {
  const { t } = useTranslation();

  LoggerService.info(`${FILE_NAME}: CaseForceProceedDialog: rendering`, { isOpen });

  if (isOpen) {
    LoggerService.warn(
      `${FILE_NAME}: CaseForceProceedDialog: rendering open branch — bypass consent requested`,
    );
  } else {
    LoggerService.info(`${FILE_NAME}: CaseForceProceedDialog: rendering closed branch`);
  }

  const handleCancel = (): void => {
    LoggerService.info(`${FILE_NAME}: handleCancel: bypass consent cancelled`);
    onCancel();
  };

  const handleAgree = (): void => {
    LoggerService.warn(`${FILE_NAME}: handleAgree: bypass consent granted`);
    onAgree();
  };

  return (
    <AlertDialog isOpen={isOpen} onClose={handleCancel} testID="case-force-proceed-dialog">
      <AlertDialogBackdrop />
      <AlertDialogContent borderTopWidth="$4" borderTopColor="$error600">
        <AlertDialogHeader>
          <HStack space="sm" alignItems="center" flex={1}>
            <AlertIcon as={AlertCircleIcon} size="lg" color="$error600" />
            <Heading
              size="md"
              fontWeight="$bold"
              color="$error700"
              sx={{ _dark: { color: '$error400' } }}
            >
              {t('caseDetails.geoFence.consent.title')}
            </Heading>
          </HStack>
          <AlertDialogCloseButton onPress={handleCancel} testID="case-force-proceed-close-button">
            <CloseIcon />
          </AlertDialogCloseButton>
        </AlertDialogHeader>
        <AlertDialogBody mt="$3" mb="$4">
          <VStack space="sm">
            <Text size="sm" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
              {t('caseDetails.geoFence.consent.body')}
            </Text>
            <Box
              bg="$error50"
              borderWidth="$1"
              borderColor="$error200"
              borderRadius="$lg"
              p="$3"
              sx={{ _dark: { bg: '$error950', borderColor: '$error800' } }}
            >
              <Text
                size="sm"
                fontWeight="$bold"
                color="$error700"
                sx={{ _dark: { color: '$error300' } }}
              >
                {t('caseDetails.geoFence.consent.scrutinyWarning')}
              </Text>
            </Box>
          </VStack>
        </AlertDialogBody>
        <AlertDialogFooter>
          <Button
            variant="outline"
            action="secondary"
            mr="$3"
            onPress={handleCancel}
            accessibilityLabel={t('caseList.actions.cancel')}
            testID="case-force-proceed-cancel-button"
          >
            <ButtonText>{t('caseList.actions.cancel')}</ButtonText>
          </Button>
          <Button
            action="negative"
            onPress={handleAgree}
            accessibilityLabel={t('caseDetails.geoFence.consent.agree')}
            testID="case-force-proceed-agree-button"
          >
            <ButtonText>{t('caseDetails.geoFence.consent.agree')}</ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
