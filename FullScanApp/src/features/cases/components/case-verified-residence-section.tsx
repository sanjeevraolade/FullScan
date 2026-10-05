import React from 'react';
import type { ReactElement } from 'react';
import {
  Box,
  Button,
  ButtonIcon,
  ButtonText,
  EditIcon,
  FormControl,
  FormControlError,
  FormControlErrorText,
  HStack,
  Icon,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { FormFieldLabel, FormSelectField, FormTextField, PersonIcon } from '@/shared/components';
import type {
  AddressType,
  ResidenceType,
  VerificationOutcomeFieldErrorKeys,
  VerificationOutcomeRequiredFields,
} from '@/domain/case';

const FILE_NAME = 'case-verified-residence-section.tsx';

const RESIDENCE_TYPES: readonly ResidenceType[] = ['owned', 'rented', 'hostel'];
const ADDRESS_TYPES: readonly AddressType[] = ['present', 'permanent'];

const NO_FIELD_ERRORS: VerificationOutcomeFieldErrorKeys = {};
const NO_REQUIRED_FIELDS: VerificationOutcomeRequiredFields = {};

export interface CaseVerifiedResidenceSectionProps {
  /** Null until the field executive picks one. */
  readonly residenceType: ResidenceType | null;
  readonly onSelectResidenceType: (type: ResidenceType) => void;
  /** Null until the field executive picks one. */
  readonly addressType: AddressType | null;
  readonly onSelectAddressType: (type: AddressType) => void;
  readonly respondentName: string;
  readonly onRespondentNameChange: (name: string) => void;
  readonly respondentRelation: string;
  readonly onRespondentRelationChange: (relation: string) => void;
  readonly isSignatureCaptured: boolean;
  readonly onCaptureSignature: () => void;
  /** Validation errors to show under each field — empty until Submit is pressed. */
  readonly fieldErrorKeys?: VerificationOutcomeFieldErrorKeys;
  /** Which of this section's fields get the red "*". */
  readonly requiredFields?: VerificationOutcomeRequiredFields;
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
  fieldErrorKeys = NO_FIELD_ERRORS,
  requiredFields = NO_REQUIRED_FIELDS,
  isReadOnly = false,
}: CaseVerifiedResidenceSectionProps): ReactElement {
  const { t } = useTranslation();

  // Respondent name/relation are candidate-adjacent PII — only lengths are logged.
  LoggerService.info(`${FILE_NAME}: CaseVerifiedResidenceSection: rendering`, {
    residenceType,
    addressType,
    respondentNameLength: respondentName.length,
    respondentRelationLength: respondentRelation.length,
    isSignatureCaptured,
    isReadOnly,
    invalidFields: Object.keys(fieldErrorKeys),
    requiredFields: Object.keys(requiredFields),
  });

  const handleSelectResidenceType = (value: string): void => {
    LoggerService.info(
      `${FILE_NAME}: CaseVerifiedResidenceSection.handleSelectResidenceType: residence type selected`,
      { value },
    );
    onSelectResidenceType(value as ResidenceType);
  };

  const handleSelectAddressType = (value: string): void => {
    LoggerService.info(
      `${FILE_NAME}: CaseVerifiedResidenceSection.handleSelectAddressType: address type selected`,
      { value },
    );
    onSelectAddressType(value as AddressType);
  };

  const handleRespondentNameChange = (name: string): void => {
    LoggerService.info(
      `${FILE_NAME}: CaseVerifiedResidenceSection.handleRespondentNameChange: respondent name changed`,
      { nameLength: name.length },
    );
    onRespondentNameChange(name);
  };

  const handleRespondentRelationChange = (relation: string): void => {
    LoggerService.info(
      `${FILE_NAME}: CaseVerifiedResidenceSection.handleRespondentRelationChange: respondent relation changed`,
      { relationLength: relation.length },
    );
    onRespondentRelationChange(relation);
  };

  const handleCaptureSignature = (): void => {
    LoggerService.info(
      `${FILE_NAME}: CaseVerifiedResidenceSection.handleCaptureSignature: signature button pressed`,
    );
    onCaptureSignature();
  };

  const isSignatureRequired = requiredFields.isSignatureCaptured === true;
  const signatureButtonLabel = t(
    isSignatureCaptured
      ? 'caseDetails.residence.signatureCaptured'
      : 'caseDetails.residence.signatureCapture',
  );
  // The label's red "*" is hidden from screen readers, so the button itself says "required".
  const signatureButtonAccessibilityLabel = isSignatureRequired
    ? t('validation.requiredFieldLabel', { label: signatureButtonLabel })
    : signatureButtonLabel;

  if (isSignatureCaptured) {
    LoggerService.info(
      `${FILE_NAME}: CaseVerifiedResidenceSection: rendering signature-captured branch`,
    );
  } else {
    LoggerService.info(
      `${FILE_NAME}: CaseVerifiedResidenceSection: rendering signature-pending branch`,
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
      testID="case-details-verified-residence-section"
    >
      <VStack space="sm">
        <HStack space="xs" alignItems="center">
          <Icon
            as={PersonIcon}
            size="sm"
            color="$primary600"
            sx={{ _dark: { color: '$primary300' } }}
          />
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
              value={residenceType ?? ''}
              onValueChange={handleSelectResidenceType}
              placeholder={t('caseDetails.residence.residenceTypePlaceholder')}
              errorKey={fieldErrorKeys.residenceType}
              isRequired={requiredFields.residenceType === true}
              options={RESIDENCE_TYPES.map((type) => {
                LoggerService.info(
                  `${FILE_NAME}: CaseVerifiedResidenceSection: mapping residence type option`,
                  { type },
                );
                return {
                  label: t(`caseDetails.residence.residenceTypeOptions.${type}`),
                  value: type,
                };
              })}
              isDisabled={isReadOnly}
            />
          </Box>
          <Box flex={1}>
            <FormSelectField
              fieldId="case-details-address-type"
              label={t('caseDetails.residence.addressTypeLabel')}
              value={addressType ?? ''}
              onValueChange={handleSelectAddressType}
              placeholder={t('caseDetails.residence.addressTypePlaceholder')}
              errorKey={fieldErrorKeys.addressType}
              isRequired={requiredFields.addressType === true}
              options={ADDRESS_TYPES.map((type) => {
                LoggerService.info(
                  `${FILE_NAME}: CaseVerifiedResidenceSection: mapping address type option`,
                  { type },
                );
                return {
                  label: t(`caseDetails.residence.addressTypeOptions.${type}`),
                  value: type,
                };
              })}
              isDisabled={isReadOnly}
            />
          </Box>
        </HStack>

        <FormTextField
          fieldId="case-details-respondent-name"
          labelKey="caseDetails.residence.respondentNameLabel"
          value={respondentName}
          onChangeText={handleRespondentNameChange}
          errorKey={fieldErrorKeys.respondentName}
          isRequired={requiredFields.respondentName === true}
          isDisabled={isReadOnly}
        />

        <FormTextField
          fieldId="case-details-respondent-relation"
          labelKey="caseDetails.residence.respondentRelationLabel"
          value={respondentRelation}
          onChangeText={handleRespondentRelationChange}
          errorKey={fieldErrorKeys.respondentRelation}
          isRequired={requiredFields.respondentRelation === true}
          isDisabled={isReadOnly}
        />

        <FormControl
          isInvalid={Boolean(fieldErrorKeys.isSignatureCaptured)}
          isDisabled={isReadOnly}
        >
          <VStack space="xs">
            <FormFieldLabel
              label={t('caseDetails.residence.signatureLabel')}
              isRequired={isSignatureRequired}
            />
            <Button
              bg="$backgroundDark900"
              borderRadius="$xl"
              onPress={handleCaptureSignature}
              isDisabled={isReadOnly}
              accessibilityLabel={signatureButtonAccessibilityLabel}
              testID="case-details-signature-button"
            >
              <ButtonIcon as={EditIcon} mr="$2" />
              <ButtonText>
                {t(
                  isSignatureCaptured
                    ? 'caseDetails.residence.signatureCaptured'
                    : 'caseDetails.residence.signatureCapture',
                )}
              </ButtonText>
            </Button>
          </VStack>
          {fieldErrorKeys.isSignatureCaptured ? (
            <FormControlError>
              <FormControlErrorText testID="case-details-signature-error">
                {t(fieldErrorKeys.isSignatureCaptured)}
              </FormControlErrorText>
            </FormControlError>
          ) : null}
        </FormControl>
      </VStack>
    </Box>
  );
}
