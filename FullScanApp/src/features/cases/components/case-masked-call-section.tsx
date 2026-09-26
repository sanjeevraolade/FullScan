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
  /** Completed cases are view-only: the numbers stay visible but calling is disabled. */
  readonly isReadOnly?: boolean;
}

/** Section 3 — masked primary/secondary phone actions; real numbers are never shown. */
export function CaseMaskedCallSection({
  maskedPrimaryPhone,
  maskedSecondaryPhone,
  onCallPrimary,
  onCallSecondary,
  isReadOnly = false,
}: CaseMaskedCallSectionProps): ReactElement {
  const { t } = useTranslation();

  // No phone number — masked, real or proxy — is ever logged; presence flags only.
  LoggerService.info(`${FILE_NAME}: CaseMaskedCallSection: rendering`, {
    hasPrimaryPhone: maskedPrimaryPhone.trim().length > 0,
    hasSecondaryPhone: maskedSecondaryPhone.trim().length > 0,
    isReadOnly,
  });

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
        <HStack justifyContent="space-between" alignItems="center" space="sm">
          <HStack space="xs" alignItems="center" flex={1}>
            <Icon as={PhoneIcon} size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }} />
            <Text size="xs" fontWeight="$bold" color="$textLight900" flexShrink={1} sx={{ _dark: { color: '$textDark0' } }}>
              {t('caseDetails.call.title')}
            </Text>
          </HStack>
          <Badge action="success" size="sm" borderRadius="$md" flexShrink={0}>
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
            space="sm"
            p="$2.5"
            sx={{ _dark: { bg: '$backgroundDark800', borderColor: '$borderDark700' } }}
          >
            {/* flex={1} lets long label/number text wrap instead of pushing the call button off screen. */}
            <VStack flex={1}>
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
              flexShrink={0}
              onPress={handleCallPrimary}
              isDisabled={isReadOnly}
              accessibilityLabel={t('caseDetails.call.callPrimary')}
              testID="case-details-call-primary"
            >
              <ButtonIcon as={PhoneIcon} mr="$1" />
              <ButtonText>{t('caseDetails.call.callButton')}</ButtonText>
            </Button>
          </HStack>

          <HStack
            justifyContent="space-between"
            alignItems="center"
            bg="$backgroundLight50"
            borderWidth="$1"
            borderColor="$borderLight200"
            borderRadius="$xl"
            space="sm"
            p="$2.5"
            sx={{ _dark: { bg: '$backgroundDark800', borderColor: '$borderDark700' } }}
          >
            {/* flex={1} lets long label/number text wrap instead of pushing the call button off screen. */}
            <VStack flex={1}>
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
              flexShrink={0}
              onPress={handleCallSecondary}
              isDisabled={isReadOnly}
              accessibilityLabel={t('caseDetails.call.callSecondary')}
              testID="case-details-call-secondary"
            >
              <ButtonIcon as={PhoneIcon} mr="$1" />
              <ButtonText>{t('caseDetails.call.callButton')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}
