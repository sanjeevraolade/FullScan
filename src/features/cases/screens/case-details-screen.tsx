import React from 'react';
import type { ReactElement } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeftIcon, Box, HStack, Icon, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';

const FILE_NAME = 'case-details-screen.tsx';

type CaseDetailsRoute = RouteProp<RootStackParamList, typeof ROUTE_NAMES.CASE_DETAILS>;

/**
 * Placeholder for the full Case Details / verification workflow screen
 * (status selection, GPS match, Verified/Respondent Details, photo capture)
 * — not built yet. Exists so tapping a case from the list has somewhere
 * real to go rather than doing nothing.
 */
export function CaseDetailsScreen(): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<CaseDetailsRoute>();

  LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: rendering`, { caseId: params.caseId });

  const handleBackPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleBackPress: back pressed`);
    navigation.goBack();
  };

  return (
    <Box flex={1}>
      <HStack alignItems="center" space="sm" px="$4" pt="$4" pb="$2">       
        <Text size="md" fontWeight="$semibold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
          {t('caseDetails.title', { caseRef: params.caseRef })}
        </Text>
      </HStack>

      <VStack space="sm" px="$4" pt="$4">
        <Text size="lg" fontWeight="$semibold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
          {params.candidateName}
        </Text>
        <Text size="sm" color="$textLight600" sx={{ _dark: { color: '$textDark300' } }}>
          {t('caseList.card.client', { clientName: params.clientName })}
        </Text>
        <Text size="sm" color="$textLight500" mt="$4" sx={{ _dark: { color: '$textDark400' } }}>
          {t('caseDetails.comingSoon')}
        </Text>
      </VStack>
    </Box>
  );
}
