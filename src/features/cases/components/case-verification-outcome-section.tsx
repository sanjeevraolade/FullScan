import React from 'react';
import type { ReactElement } from 'react';
import { Box, HStack, Icon, SettingsIcon, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { FormSelectField, FormTextareaField } from '@/shared/components';
import type { DropdownOption } from '@/domain/reference-data';

const FILE_NAME = 'case-verification-outcome-section.tsx';

export interface CaseVerificationOutcomeSectionProps {
  readonly statusOptions: readonly DropdownOption[];
  readonly verificationStatus: string;
  readonly onSelectStatus: (status: string) => void;

  readonly isUtvSectionVisible: boolean;
  readonly utvReasonOptions: readonly DropdownOption[];
  readonly utvReason: string;
  readonly onSelectUtvReason: (reason: string) => void;
  readonly utvRemarks: string;
  readonly onUtvRemarksChange: (remarks: string) => void;

  readonly isInsufficientSectionVisible: boolean;
  readonly insufficientReasonOptions: readonly DropdownOption[];
  readonly insufficientReason: string;
  readonly onSelectInsufficientReason: (reason: string) => void;
  readonly insufficientRemarks: string;
  readonly onInsufficientRemarksChange: (remarks: string) => void;

  readonly isReadOnly?: boolean;
}

/** Section 5 — verification status outcome, with UTV / Insufficient follow-up fields. */
export function CaseVerificationOutcomeSection({
  statusOptions,
  verificationStatus,
  onSelectStatus,
  isUtvSectionVisible,
  utvReasonOptions,
  utvReason,
  onSelectUtvReason,
  utvRemarks,
  onUtvRemarksChange,
  isInsufficientSectionVisible,
  insufficientReasonOptions,
  insufficientReason,
  onSelectInsufficientReason,
  insufficientRemarks,
  onInsufficientRemarksChange,
  isReadOnly = false,
}: CaseVerificationOutcomeSectionProps): ReactElement {
  const { t } = useTranslation();

  // Remarks are free text that can carry candidate details — only lengths are logged.
  LoggerService.info(`${FILE_NAME}: CaseVerificationOutcomeSection: rendering`, {
    verificationStatus,
    isUtvSectionVisible,
    isInsufficientSectionVisible,
    isReadOnly,
    statusOptionCount: statusOptions.length,
  });

  const handleSelectStatus = (status: string): void => {
    LoggerService.info(`${FILE_NAME}: CaseVerificationOutcomeSection.handleSelectStatus: status selected`, {
      status,
    });
    onSelectStatus(status);
  };

  const handleSelectUtvReason = (reason: string): void => {
    LoggerService.info(`${FILE_NAME}: CaseVerificationOutcomeSection.handleSelectUtvReason: utv reason selected`, {
      reason,
    });
    onSelectUtvReason(reason);
  };

  const handleUtvRemarksChange = (remarks: string): void => {
    LoggerService.info(`${FILE_NAME}: CaseVerificationOutcomeSection.handleUtvRemarksChange: utv remarks changed`, {
      remarksLength: remarks.length,
    });
    onUtvRemarksChange(remarks);
  };

  const handleSelectInsufficientReason = (reason: string): void => {
    LoggerService.info(
      `${FILE_NAME}: CaseVerificationOutcomeSection.handleSelectInsufficientReason: insufficient reason selected`,
      { reason },
    );
    onSelectInsufficientReason(reason);
  };

  const handleInsufficientRemarksChange = (remarks: string): void => {
    LoggerService.info(
      `${FILE_NAME}: CaseVerificationOutcomeSection.handleInsufficientRemarksChange: insufficient remarks changed`,
      { remarksLength: remarks.length },
    );
    onInsufficientRemarksChange(remarks);
  };

  if (isUtvSectionVisible) {
    LoggerService.info(`${FILE_NAME}: CaseVerificationOutcomeSection: rendering utv follow-up branch`);
  }

  if (isInsufficientSectionVisible) {
    LoggerService.info(
      `${FILE_NAME}: CaseVerificationOutcomeSection: rendering insufficient follow-up branch`,
    );
  }

  if (!isUtvSectionVisible && !isInsufficientSectionVisible) {
    LoggerService.info(
      `${FILE_NAME}: CaseVerificationOutcomeSection: rendering status-only branch — no follow-up required`,
    );
  }

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
          <Icon as={SettingsIcon} size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }} />
          <Text size="xs" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
            {t('caseDetails.outcome.title')}
          </Text>
        </HStack>

        <FormSelectField
          fieldId="case-details-status"
          label={t('caseDetails.outcome.statusLabel')}
          value={verificationStatus}
          onValueChange={handleSelectStatus}
          options={statusOptions.map((status) => {
            LoggerService.info(
              `${FILE_NAME}: CaseVerificationOutcomeSection: mapping status option`,
              { code: status.code },
            );
            return { label: status.label, value: status.code };
          })}
          isDisabled={isReadOnly}
        />

        {isUtvSectionVisible ? (
          <VStack
            space="sm"
            bg="$warning50"
            borderWidth="$1"
            borderColor="$warning300"
            borderRadius="$xl"
            p="$2.5"
            sx={{ _dark: { bg: '$warning950', borderColor: '$warning800' } }}
          >
            <Text size="2xs" fontWeight="$bold" color="$warning900" sx={{ _dark: { color: '$warning300' } }}>
              {t('caseDetails.outcome.utvTitle')}
            </Text>
            <FormSelectField
              fieldId="case-details-utv-reason"
              label={t('caseDetails.outcome.utvReasonLabel')}
              value={utvReason}
              onValueChange={handleSelectUtvReason}
              options={utvReasonOptions.map((reason) => {
                LoggerService.info(
                  `${FILE_NAME}: CaseVerificationOutcomeSection: mapping utv reason option`,
                  { code: reason.code },
                );
                return { label: reason.label, value: reason.code };
              })}
              isDisabled={isReadOnly}
            />
            <FormTextareaField
              fieldId="case-details-utv-remarks"
              label={t('caseDetails.outcome.utvRemarksLabel')}
              value={utvRemarks}
              onChangeText={handleUtvRemarksChange}
              placeholder={t('caseDetails.outcome.utvRemarksPlaceholder')}
              isDisabled={isReadOnly}
            />
          </VStack>
        ) : null}

        {isInsufficientSectionVisible ? (
          <VStack
            space="sm"
            bg="$error50"
            borderWidth="$1"
            borderColor="$error300"
            borderRadius="$xl"
            p="$2.5"
            sx={{ _dark: { bg: '$error950', borderColor: '$error800' } }}
          >
            <Text size="2xs" fontWeight="$bold" color="$error900" sx={{ _dark: { color: '$error300' } }}>
              {t('caseDetails.outcome.insufficientTitle')}
            </Text>
            <FormSelectField
              fieldId="case-details-insufficient-reason"
              label={t('caseDetails.outcome.insufficientReasonLabel')}
              value={insufficientReason}
              onValueChange={handleSelectInsufficientReason}
              options={insufficientReasonOptions.map((reason) => {
                LoggerService.info(
                  `${FILE_NAME}: CaseVerificationOutcomeSection: mapping insufficient reason option`,
                  { code: reason.code },
                );
                return { label: reason.label, value: reason.code };
              })}
              isDisabled={isReadOnly}
            />
            <FormTextareaField
              fieldId="case-details-insufficient-remarks"
              label={t('caseDetails.outcome.insufficientRemarksLabel')}
              value={insufficientRemarks}
              onChangeText={handleInsufficientRemarksChange}
              placeholder={t('caseDetails.outcome.insufficientRemarksPlaceholder')}
              isDisabled={isReadOnly}
            />
          </VStack>
        ) : null}
      </VStack>
    </Box>
  );
}
