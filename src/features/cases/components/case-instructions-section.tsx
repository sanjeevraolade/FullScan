import React from 'react';
import type { ReactElement } from 'react';
import { AlertCircleIcon, Box, EditIcon, HStack, Icon, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'case-instructions-section.tsx';

export interface CaseInstructionsSectionProps {
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
}

/** Section 4 — client SOP instructions and special field-executive notes. */
export function CaseInstructionsSection({
  clientInstructions,
  fieldExecutiveNotes,
}: CaseInstructionsSectionProps): ReactElement {
  const { t } = useTranslation();

  LoggerService.info(`${FILE_NAME}: CaseInstructionsSection: rendering`, {
    hasClientInstructions: clientInstructions.trim().length > 0,
    hasFieldExecutiveNotes: fieldExecutiveNotes.trim().length > 0,
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
        <HStack space="xs" alignItems="center">
          <Icon as={EditIcon} size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }} />
          <Text size="xs" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
            {t('caseDetails.instructions.title')}
          </Text>
        </HStack>

        <VStack
          space="xs"
          bg="$primary50"
          borderWidth="$1"
          borderColor="$primary100"
          borderRadius="$xl"
          p="$2.5"
          sx={{ _dark: { bg: '$primary950', borderColor: '$primary900' } }}
        >
          <Text size="2xs" fontWeight="$bold" color="$primary800" sx={{ _dark: { color: '$primary300' } }}>
            {t('caseDetails.instructions.clientInstructions')}
          </Text>
          <Text size="2xs" color="$textLight700" sx={{ _dark: { color: '$textDark200' } }}>
            {clientInstructions}
          </Text>
        </VStack>

        <VStack
          space="xs"
          bg="$warning50"
          borderWidth="$1"
          borderColor="$warning200"
          borderRadius="$xl"
          p="$2.5"
          sx={{ _dark: { bg: '$warning950', borderColor: '$warning800' } }}
        >
          <HStack space="xs" alignItems="center">
            <Icon as={AlertCircleIcon} size="xs" color="$warning900" sx={{ _dark: { color: '$warning300' } }} />
            <Text size="2xs" fontWeight="$bold" color="$warning900" sx={{ _dark: { color: '$warning300' } }}>
              {t('caseDetails.instructions.fieldExecutiveNotes')}
            </Text>
          </HStack>
          <Text size="2xs" color="$warning900" sx={{ _dark: { color: '$warning200' } }}>
            {fieldExecutiveNotes}
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
