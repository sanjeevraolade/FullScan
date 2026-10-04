import React from 'react';
import type { ReactElement } from 'react';
import { Box, HStack, Icon, InfoIcon, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import type { CaseDetail } from '@/domain/case';

const FILE_NAME = 'case-info-section.tsx';

export interface CaseInfoSectionProps {
  readonly caseDetail: CaseDetail;
}

/** Section 1 — candidate, assignment and SLA information. */
export function CaseInfoSection({ caseDetail }: CaseInfoSectionProps): ReactElement {
  const { t } = useTranslation();

  LoggerService.info(`${FILE_NAME}: CaseInfoSection: rendering`, {
    caseId: caseDetail.id,
    checkId: caseDetail.checkId,
    bucket: caseDetail.bucket,
    verificationType: caseDetail.verificationType,
  });

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
        <HStack
          justifyContent="space-between"
          alignItems="center"
          pb="$2"
          borderBottomWidth="$1"
          borderBottomColor="$borderLight100"
          sx={{ _dark: { borderBottomColor: '$borderDark800' } }}
        >
          <HStack space="xs" alignItems="center">
            <Icon as={InfoIcon} size="sm" color="$primary600" sx={{ _dark: { color: '$primary300' } }} />
            <Text
              size="xs"
              fontWeight="$bold"
              color="$primary700"
              textTransform="uppercase"
              sx={{ _dark: { color: '$primary300' } }}
            >
              {t('caseDetails.info.title')}
            </Text>
          </HStack>
          <Text size="2xs" fontWeight="$bold" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
            {t('caseDetails.info.sla', { tatDue: caseDetail.tatDueAt.toLocaleString() })}
          </Text>
        </HStack>

        <VStack space="xs">
          <Text size="2xs" fontWeight="$bold" color="$textLight400" textTransform="uppercase">
            {t('caseDetails.info.candidateName')}
          </Text>
          <Text size="md" fontWeight="$extrabold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
            {caseDetail.candidateName}
          </Text>
        </VStack>

        <HStack space="md">
          <VStack flex={1} space="xs">
            <Text size="2xs" fontWeight="$bold" color="$textLight400" textTransform="uppercase">
              {t('caseDetails.info.fatherOrSpouseName')}
            </Text>
            <Text size="sm" fontWeight="$bold" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
              {caseDetail.fatherOrSpouseName}
            </Text>
          </VStack>
          <VStack flex={1} space="xs">
            <Text size="2xs" fontWeight="$bold" color="$textLight400" textTransform="uppercase">
              {t('caseDetails.info.employerName')}
            </Text>
            <Text size="sm" fontWeight="$bold" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
              {caseDetail.employerName}
            </Text>
          </VStack>
        </HStack>

        <HStack
          space="md"
          pt="$2"
          borderTopWidth="$1"
          borderTopColor="$borderLight100"
          sx={{ _dark: { borderTopColor: '$borderDark800' } }}
        >
          <VStack flex={1} space="xs">
            <Text size="2xs" fontWeight="$bold" color="$textLight400" textTransform="uppercase">
              {t('caseDetails.info.verificationType')}
            </Text>
            <Text size="sm" fontWeight="$bold" color="$primary700" sx={{ _dark: { color: '$primary300' } }}>
              {caseDetail.verificationType}
            </Text>
          </VStack>
          <VStack flex={1} space="xs">
            <Text size="2xs" fontWeight="$bold" color="$textLight400" textTransform="uppercase">
              {t('caseDetails.info.client')}
            </Text>
            <Text size="sm" fontWeight="$bold" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
              {caseDetail.clientName}
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
}
