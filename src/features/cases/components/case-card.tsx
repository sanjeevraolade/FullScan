import React from 'react';
import type { ReactElement } from 'react';
import { Button, ButtonIcon, ButtonSpinner, ButtonText, HStack, PhoneIcon, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import type { Case } from '@/domain/case';

const FILE_NAME = 'case-card.tsx';

export interface CaseCardProps {
  readonly caseItem: Case;
  /** Tapping anywhere on the card outside the action buttons opens Case Details. */
  readonly onPress?: ((caseItem: Case) => void) | undefined;
  /** Present only for New-bucket cases. */
  readonly onAccept?: ((caseId: string) => void) | undefined;
  readonly isAccepting?: boolean;
  /** Present only for Pending/Beyond TAT cases. */
  readonly onCall?: ((caseId: string) => void) | undefined;
}

/** A single case's summary in the case-list landing page. */
export function CaseCard({ caseItem, onPress, onAccept, isAccepting = false, onCall }: CaseCardProps): ReactElement {
  const { t } = useTranslation();

  const handlePress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseCard.handlePress: card pressed`, { caseId: caseItem.id });
    onPress?.(caseItem);
  };

  const handleAccept = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseCard.handleAccept: accept pressed`, { caseId: caseItem.id });
    onAccept?.(caseItem.id);
  };

  const handleCall = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseCard.handleCall: call pressed`, { caseId: caseItem.id });
    onCall?.(caseItem.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      bg="$backgroundLight0"
      borderWidth="$1"
      borderColor="$borderLight200"
      borderRadius="$lg"
      p="$4"
      sx={{ _dark: { bg: '$backgroundDark900', borderColor: '$borderDark700' } }}
      accessibilityRole="button"
      accessibilityLabel={t('caseList.card.caseRef', { caseRef: caseItem.caseRef })}
      testID={`case-card-${caseItem.id}`}
    >
      <VStack space="xs">
        <Text size="xs" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
          {t('caseList.card.caseRef', { caseRef: caseItem.caseRef })}
        </Text>
        <Text size="sm" color="$textLight600" sx={{ _dark: { color: '$textDark300' } }}>
          {t('caseList.card.client', { clientName: caseItem.clientName })}
        </Text>
        <Text size="md" fontWeight="$semibold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
          {caseItem.candidateName}
        </Text>
        <Text size="sm" color="$textLight600" sx={{ _dark: { color: '$textDark300' } }}>
          {caseItem.address}
        </Text>

        {onAccept || onCall ? (
          <HStack justifyContent="flex-end" mt="$2">
            {onAccept ? (
              <Button
                action="positive"
                size="sm"
                onPress={handleAccept}
                isDisabled={isAccepting}
                accessibilityLabel={t('caseList.actions.accept')}
                testID={`case-card-accept-${caseItem.id}`}
              >
                {isAccepting ? <ButtonSpinner mr="$2" /> : null}
                <ButtonText>{t('caseList.actions.accept')}</ButtonText>
              </Button>
            ) : null}
            {onCall ? (
              <Button
                action="positive"
                size="sm"
                onPress={handleCall}
                accessibilityLabel={t('caseList.actions.call')}
                testID={`case-card-call-${caseItem.id}`}
              >
                <ButtonIcon as={PhoneIcon} mr="$2" />
                <ButtonText>{t('caseList.actions.call')}</ButtonText>
              </Button>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
    </Pressable>
  );
}
