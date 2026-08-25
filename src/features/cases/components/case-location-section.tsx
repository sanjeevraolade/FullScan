import React from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  AlertCircleIcon,
  AlertIcon,
  AlertText,
  Box,
  CheckCircleIcon,
  HStack,
  Icon,
  Pressable,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { MapPinIcon } from '@/shared/components';
import type { GpsCheck } from '@/domain/case';

const FILE_NAME = 'case-location-section.tsx';

export interface CaseLocationSectionProps {
  readonly address: string;
  readonly gpsCheck: GpsCheck;
  readonly onGetDirections: () => void;
}

/** Section 2 — target address, the "get directions" link, and the GPS match banner. */
export function CaseLocationSection({ address, gpsCheck, onGetDirections }: CaseLocationSectionProps): ReactElement {
  const { t } = useTranslation();

  const handlePress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection.handlePress: location link tapped`);
    onGetDirections();
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
            <Icon as={MapPinIcon} size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }} />
            <Text size="xs" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
              {t('caseDetails.location.title')}
            </Text>
          </HStack>
          <Box bg="$backgroundLight100" px="$2" py="$0.5" borderRadius="$sm" sx={{ _dark: { bg: '$backgroundDark800' } }}>
            <Text size="2xs" fontFamily="$mono" fontWeight="$bold" color="$textLight600" sx={{ _dark: { color: '$textDark300' } }}>
              {t('caseDetails.location.coordinates', {
                latitude: gpsCheck.targetLatitude,
                longitude: gpsCheck.targetLongitude,
              })}
            </Text>
          </Box>
        </HStack>

        <Pressable
          onPress={handlePress}
          bg="$primary50"
          borderWidth="$1"
          borderColor="$primary200"
          borderRadius="$xl"
          p="$3"
          sx={{ _dark: { bg: '$primary950', borderColor: '$primary800' } }}
          accessibilityRole="button"
          accessibilityLabel={t('caseDetails.location.getDirections')}
          testID="case-details-location-link"
        >
          <VStack space="xs">
            <Text size="sm" fontWeight="$medium" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
              {address}
            </Text>
            <HStack
              justifyContent="space-between"
              alignItems="center"
              pt="$1"
              borderTopWidth="$1"
              borderTopColor="$primary200"
              sx={{ _dark: { borderTopColor: '$primary800' } }}
            >
              <Text size="2xs" fontWeight="$bold" color="$primary600" sx={{ _dark: { color: '$primary300' } }}>
                {t('caseDetails.location.tapHint')}
              </Text>
              <Text size="2xs" fontWeight="$bold" color="$primary600" sx={{ _dark: { color: '$primary300' } }}>
                {t('caseDetails.location.getDirections')}
              </Text>
            </HStack>
          </VStack>
        </Pressable>

        <Alert action={gpsCheck.isWithinRange ? 'success' : 'error'} testID="case-details-gps-banner">
          <AlertIcon as={gpsCheck.isWithinRange ? CheckCircleIcon : AlertCircleIcon} mr="$2" />
          <AlertText>
            {t(gpsCheck.isWithinRange ? 'caseDetails.location.gpsMatch' : 'caseDetails.location.gpsAlert', {
              distance: t('caseDetails.location.distanceMeters', { distance: gpsCheck.distanceMeters }),
            })}
          </AlertText>
        </Alert>
      </VStack>
    </Box>
  );
}
