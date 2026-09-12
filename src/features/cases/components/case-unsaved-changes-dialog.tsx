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

const FILE_NAME = 'case-unsaved-changes-dialog.tsx';

export interface CaseUnsavedChangesDialogProps {
  readonly isOpen: boolean;
  readonly onKeepEditing: () => void;
  readonly onSaveDraft: () => void;
  readonly onDiscard: () => void;
}

/**
 * The guard behind the Case Details back button.
 *
 * A field executive who has entered verification details and taps back by
 * mistake would otherwise lose them silently — nothing on this screen is
 * persisted until "Save as Draft" or "Submit". Saving the draft on the way out
 * is the recommended path and comes first; Keep Editing returns to the form
 * untouched; Discard is the only route that throws the answers away.
 */
export function CaseUnsavedChangesDialog({
  isOpen,
  onKeepEditing,
  onSaveDraft,
  onDiscard,
}: CaseUnsavedChangesDialogProps): ReactElement {
  const { t } = useTranslation();

  LoggerService.info(`${FILE_NAME}: CaseUnsavedChangesDialog: rendering`, { isOpen });

  const handleKeepEditing = (): void => {
    LoggerService.info(`${FILE_NAME}: handleKeepEditing: staying on the case`);
    onKeepEditing();
  };

  const handleSaveDraft = (): void => {
    LoggerService.info(`${FILE_NAME}: handleSaveDraft: saving the draft before leaving`);
    onSaveDraft();
  };

  const handleDiscard = (): void => {
    LoggerService.warn(`${FILE_NAME}: handleDiscard: discarding unsaved case answers`);
    onDiscard();
  };

  return (
    <AlertDialog isOpen={isOpen} onClose={handleKeepEditing} testID="case-unsaved-changes-dialog">
      <AlertDialogBackdrop />
      <AlertDialogContent borderTopWidth="$4" borderTopColor="$warning600">
        <AlertDialogHeader>
          <HStack space="sm" alignItems="center" flex={1}>
            <AlertIcon as={AlertCircleIcon} size="lg" color="$warning600" />
            <Heading
              size="md"
              fontWeight="$bold"
              color="$warning700"
              sx={{ _dark: { color: '$warning400' } }}
            >
              {t('caseDetails.unsavedChanges.title')}
            </Heading>
          </HStack>
          <AlertDialogCloseButton
            onPress={handleKeepEditing}
            testID="case-unsaved-changes-close-button"
          >
            <CloseIcon />
          </AlertDialogCloseButton>
        </AlertDialogHeader>
        <AlertDialogBody mt="$3" mb="$4">
          <Text size="sm" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
            {t('caseDetails.unsavedChanges.message')}
          </Text>
        </AlertDialogBody>
        {/* Stacked, full width: three actions do not fit side by side on a phone. */}
        <AlertDialogFooter>
          <VStack space="sm" width="$full">
            <Button
              action="positive"
              borderRadius="$xl"
              onPress={handleSaveDraft}
              accessibilityLabel={t('caseDetails.unsavedChanges.saveDraft')}
              testID="case-unsaved-changes-save-draft-button"
            >
              <ButtonText>{t('caseDetails.unsavedChanges.saveDraft')}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="secondary"
              borderRadius="$xl"
              onPress={handleKeepEditing}
              accessibilityLabel={t('caseDetails.unsavedChanges.keepEditing')}
              testID="case-unsaved-changes-keep-editing-button"
            >
              <ButtonText>{t('caseDetails.unsavedChanges.keepEditing')}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="negative"
              borderRadius="$xl"
              onPress={handleDiscard}
              accessibilityLabel={t('caseDetails.unsavedChanges.discard')}
              testID="case-unsaved-changes-discard-button"
            >
              <ButtonText>{t('caseDetails.unsavedChanges.discard')}</ButtonText>
            </Button>
          </VStack>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
