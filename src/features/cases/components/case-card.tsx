import React from 'react';
import type { ReactElement } from 'react';
import {
  ArrowRightIcon,
  Badge,
  BadgeText,
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
  Divider,
  HStack,
  Icon,
  PhoneIcon,
  Pressable,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { BriefcaseIcon, MapPinIcon, PersonIcon } from '@/shared/components';
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
      <VStack space="sm">
        <HStack space="sm" justifyContent="space-between" alignItems="flex-start">
          <Text size="sm" fontWeight="$bold" color="$textLight900" flex={1} sx={{ _dark: { color: '$textDark0' } }}>
            {t('caseList.card.caseRef', { caseRef: caseItem.caseRef })}
          </Text>
          <Badge size="sm" borderRadius="$md">
            <BadgeText textTransform="none">{caseItem.verificationType}</BadgeText>
          </Badge>
        </HStack>

        <VStack space="xs">
          <HStack space="xs" alignItems="center">
            <Icon as={BriefcaseIcon} size="xs" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }} />
            <Text size="sm" color="$textLight600" sx={{ _dark: { color: '$textDark300' } }}>
              {t('caseList.card.client', { clientName: caseItem.clientName })}
            </Text>
          </HStack>
          <HStack space="xs" alignItems="center">
            <Icon as={PersonIcon} size="xs" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }} />
            <Text size="sm" color="$textLight600" sx={{ _dark: { color: '$textDark300' } }}>
              {t('caseList.card.candidate', { candidateName: caseItem.candidateName })}
            </Text>
          </HStack>
          <HStack space="xs" alignItems="flex-start">
            <Icon as={MapPinIcon} size="xs" color="$textLight500" mt="$1" sx={{ _dark: { color: '$textDark400' } }} />
            <Text size="sm" color="$textLight600" flex={1} sx={{ _dark: { color: '$textDark300' } }}>
              {caseItem.address}
            </Text>
          </HStack>
        </VStack>

        <Divider bg="$borderLight200" sx={{ _dark: { bg: '$borderDark700' } }} />

        <HStack justifyContent="space-between" alignItems="center">
          <HStack alignItems="center" testID={`case-card-view-details-${caseItem.id}`}>
            <Text size="sm" fontWeight="$medium" color="$primary600" mr="$1" sx={{ _dark: { color: '$primary300' } }}>
              {t('caseList.actions.viewFormDetails')}
            </Text>
            <Icon as={ArrowRightIcon} size="xs" color="$primary600" sx={{ _dark: { color: '$primary300' } }} />
          </HStack>

          {onAccept ? (
            <Button
              action="positive"
              size="sm"
              borderRadius="$full"
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
              borderRadius="$full"
              onPress={handleCall}
              accessibilityLabel={t('caseList.actions.call')}
              testID={`case-card-call-${caseItem.id}`}
            >
              <ButtonIcon as={PhoneIcon} mr="$2" />
              <ButtonText>{t('caseList.actions.call')}</ButtonText>
            </Button>
          ) : null}
        </HStack>
      </VStack>
    </Pressable>
  );
}
