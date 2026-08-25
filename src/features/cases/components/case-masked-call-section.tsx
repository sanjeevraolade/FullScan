import React from 'react';
import type { ReactElement } from 'react';
import { Badge, BadgeText, Box, Button, ButtonIcon, ButtonText, HStack, Icon, PhoneIcon, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'case-masked-call-section.tsx';

export interface CaseMaskedCallSectionProps {
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly onCallPrimary: () => void;
  readonly onCallSecondary: () => void;
}

/** Section 3 — masked primary/secondary phone actions; real numbers are never shown. */
export function CaseMaskedCallSection({
  maskedPrimaryPhone,
  maskedSecondaryPhone,
  onCallPrimary,
  onCallSecondary,
}: CaseMaskedCallSectionProps): ReactElement {
  const { t } = useTranslation();

  const handleCallPrimary = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseMaskedCallSection.handleCallPrimary: primary call pressed`);
    onCallPrimary();
  };

  const handleCallSecondary = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseMaskedCallSection.handleCallSecondary: secondary call pressed`);
    onCallSecondary();
  };

  return (
    <Box
      bg="$backgroundLight0"
      borderWidth="$1"
      borderColor="$borderLight200"
      borderRadius="$2xl"
      p="$4"
      sx={{ _dark: { bg: '$backgroundDark900', borderColor: '$borderDark700' } }}
    >
      <VStack space="sm">
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space="xs" alignItems="center">
            <Icon as={PhoneIcon} size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }} />
            <Text size="xs" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
              {t('caseDetails.call.title')}
            </Text>
          </HStack>
          <Badge action="success" size="sm" borderRadius="$md">
            <BadgeText textTransform="none">{t('caseDetails.call.privacyLock')}</BadgeText>
          </Badge>
        </HStack>

        <Text size="2xs" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
          {t('caseDetails.call.description')}
        </Text>

        <VStack space="sm">
          <HStack
            justifyContent="space-between"
            alignItems="center"
            bg="$backgroundLight50"
            borderWidth="$1"
            borderColor="$borderLight200"
            borderRadius="$xl"
            p="$2.5"
            sx={{ _dark: { bg: '$backgroundDark800', borderColor: '$borderDark700' } }}
          >
            <VStack>
              <Text size="2xs" fontWeight="$bold" color="$textLight400" textTransform="uppercase">
                {t('caseDetails.call.primaryLabel')}
              </Text>
              <Text size="sm" fontFamily="$mono" fontWeight="$extrabold" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
                {maskedPrimaryPhone}
              </Text>
            </VStack>
            <Button
              action="positive"
              size="sm"
              borderRadius="$lg"
              onPress={handleCallPrimary}
              accessibilityLabel={t('caseDetails.call.callPrimary')}
              testID="case-details-call-primary"
            >
              <ButtonIcon as={PhoneIcon} mr="$1" />
              <ButtonText>{t('caseDetails.call.callPrimary')}</ButtonText>
            </Button>
          </HStack>

          <HStack
            justifyContent="space-between"
            alignItems="center"
            bg="$backgroundLight50"
            borderWidth="$1"
            borderColor="$borderLight200"
            borderRadius="$xl"
            p="$2.5"
            sx={{ _dark: { bg: '$backgroundDark800', borderColor: '$borderDark700' } }}
          >
            <VStack>
              <Text size="2xs" fontWeight="$bold" color="$textLight400" textTransform="uppercase">
                {t('caseDetails.call.secondaryLabel')}
              </Text>
              <Text size="sm" fontFamily="$mono" fontWeight="$extrabold" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
                {maskedSecondaryPhone}
              </Text>
            </VStack>
            <Button
              size="sm"
              borderRadius="$lg"
              onPress={handleCallSecondary}
              accessibilityLabel={t('caseDetails.call.callSecondary')}
              testID="case-details-call-secondary"
            >
              <ButtonIcon as={PhoneIcon} mr="$1" />
              <ButtonText>{t('caseDetails.call.callSecondary')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}
