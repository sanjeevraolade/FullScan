import React from 'react';
import type { ReactElement } from 'react';
import { Box, Button, ButtonIcon, ButtonText, EditIcon, HStack, Icon, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { FormSelectField, FormTextField, PersonIcon } from '@/shared/components';
import type { AddressType, ResidenceType } from '@/domain/case';

const FILE_NAME = 'case-verified-residence-section.tsx';

const RESIDENCE_TYPES: readonly ResidenceType[] = ['owned', 'rented', 'hostel'];
const ADDRESS_TYPES: readonly AddressType[] = ['present', 'permanent'];

export interface CaseVerifiedResidenceSectionProps {
  readonly residenceType: ResidenceType;
  readonly onSelectResidenceType: (type: ResidenceType) => void;
  readonly addressType: AddressType;
  readonly onSelectAddressType: (type: AddressType) => void;
  readonly respondentName: string;
  readonly onRespondentNameChange: (name: string) => void;
  readonly respondentRelation: string;
  readonly onRespondentRelationChange: (relation: string) => void;
  readonly isSignatureCaptured: boolean;
  readonly onCaptureSignature: () => void;
  readonly isReadOnly?: boolean;
}

/** Section 6 — shown only for a "Verified Clear" outcome with a matching GPS check. */
export function CaseVerifiedResidenceSection({
  residenceType,
  onSelectResidenceType,
  addressType,
  onSelectAddressType,
  respondentName,
  onRespondentNameChange,
  respondentRelation,
  onRespondentRelationChange,
  isSignatureCaptured,
  onCaptureSignature,
  isReadOnly = false,
}: CaseVerifiedResidenceSectionProps): ReactElement {
  const { t } = useTranslation();

  const handleCaptureSignature = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseVerifiedResidenceSection.handleCaptureSignature: signature button pressed`);
    onCaptureSignature();
  };

  return (
    <Box
      bg="$backgroundLight0"
      borderWidth="$1"
      borderColor="$borderLight200"
      borderRadius="$2xl"
      p="$4"
      sx={{ _dark: { bg: '$backgroundDark900', borderColor: '$borderDark700' } }}
      testID="case-details-verified-residence-section"
    >
      <VStack space="sm">
        <HStack space="xs" alignItems="center">
          <Icon as={PersonIcon} size="sm" color="$primary600" sx={{ _dark: { color: '$primary300' } }} />
          <Text
            size="xs"
            fontWeight="$bold"
            color="$primary700"
            textTransform="uppercase"
            sx={{ _dark: { color: '$primary300' } }}
          >
            {t('caseDetails.residence.title')}
          </Text>
        </HStack>

        <HStack space="sm">
          <Box flex={1}>
            <FormSelectField
              fieldId="case-details-residence-type"
              label={t('caseDetails.residence.residenceTypeLabel')}
              value={residenceType}
              onValueChange={(value) => onSelectResidenceType(value as ResidenceType)}
              options={RESIDENCE_TYPES.map((type) => ({
                label: t(`caseDetails.residence.residenceTypeOptions.${type}`),
                value: type,
              }))}
              isDisabled={isReadOnly}
            />
          </Box>
          <Box flex={1}>
            <FormSelectField
              fieldId="case-details-address-type"
              label={t('caseDetails.residence.addressTypeLabel')}
              value={addressType}
              onValueChange={(value) => onSelectAddressType(value as AddressType)}
              options={ADDRESS_TYPES.map((type) => ({
                label: t(`caseDetails.residence.addressTypeOptions.${type}`),
                value: type,
              }))}
              isDisabled={isReadOnly}
            />
          </Box>
        </HStack>

        <FormTextField
          fieldId="case-details-respondent-name"
          labelKey="caseDetails.residence.respondentNameLabel"
          value={respondentName}
          onChangeText={onRespondentNameChange}
          isDisabled={isReadOnly}
        />

        <FormTextField
          fieldId="case-details-respondent-relation"
          labelKey="caseDetails.residence.respondentRelationLabel"
          value={respondentRelation}
          onChangeText={onRespondentRelationChange}
          isDisabled={isReadOnly}
        />

        <VStack space="xs">
          <Text size="2xs" fontWeight="$bold" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
            {t('caseDetails.residence.signatureLabel')}
          </Text>
          <Button
            bg="$backgroundDark900"
            borderRadius="$xl"
            onPress={handleCaptureSignature}
            isDisabled={isReadOnly}
            accessibilityLabel={t(
              isSignatureCaptured ? 'caseDetails.residence.signatureCaptured' : 'caseDetails.residence.signatureCapture',
            )}
            testID="case-details-signature-button"
          >
            <ButtonIcon as={EditIcon} mr="$2" />
            <ButtonText>
              {t(isSignatureCaptured ? 'caseDetails.residence.signatureCaptured' : 'caseDetails.residence.signatureCapture')}
            </ButtonText>
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
}
