import React, { useLayoutEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  AlertCircleIcon,
  AlertIcon,
  AlertText,
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  ScrollView,
  Spinner,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';

import { CaseInfoSection } from '../components/case-info-section';
import { CaseInstructionsSection } from '../components/case-instructions-section';
import { CaseLocationSection } from '../components/case-location-section';
import { CaseMaskedCallSection } from '../components/case-masked-call-section';
import { CasePhotoEvidenceSection } from '../components/case-photo-evidence-section';
import { CaseVerificationOutcomeSection } from '../components/case-verification-outcome-section';
import { CaseVerifiedResidenceSection } from '../components/case-verified-residence-section';
import { useCaseDetails } from '../hooks/use-case-details';

const FILE_NAME = 'case-details-screen.tsx';

type CaseDetailsRoute = RouteProp<RootStackParamList, typeof ROUTE_NAMES.CASE_DETAILS>;

/**
 * The full Case Details / verification workflow screen: assignment
 * information, the target-location GPS check, masked call actions, client
 * instructions, the verification-status outcome form (with its UTV /
 * Insufficient / Verified-Residence follow-ups), and photo evidence capture.
 * Presentation only — all data and form state live in `useCaseDetails`;
 * everything not yet backed by real infrastructure (masked telephony,
 * camera hardware, signature capture, map deep-linking) surfaces a
 * "coming soon" notice instead of pretending to work.
 */
export function CaseDetailsScreen(): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<CaseDetailsRoute>();
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const {
    caseDetail,
    referenceData,
    isLoading,
    loadError,
    refresh,
    verificationStatus,
    selectVerificationStatus,
    isUtvSectionVisible,
    utvReason,
    selectUtvReason,
    utvRemarks,
    setUtvRemarks,
    isInsufficientSectionVisible,
    insufficientReason,
    selectInsufficientReason,
    insufficientRemarks,
    setInsufficientRemarks,
    isVerifiedResidenceSectionVisible,
    residenceType,
    selectResidenceType,
    addressType,
    selectAddressType,
    respondentName,
    setRespondentName,
    respondentRelation,
    setRespondentRelation,
    isSignatureCaptured,
    markSignatureCaptured,
    selectedPhotoTag,
    selectPhotoTag,
    isSubmitting,
    submitError,
    submit,
  } = useCaseDetails(params.caseId);

  LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: rendering`, { caseId: params.caseId });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: caseDetail ? t('caseDetails.title', { caseRef: caseDetail.caseRef }) : '',
      headerRight: () =>
        caseDetail ? (
          <Badge action="warning" size="sm" borderRadius="$md" mr="$4">
            <BadgeText textTransform="uppercase">{t(`caseList.tabs.${caseDetail.bucket}`)}</BadgeText>
          </Badge>
        ) : null,
    });
  }, [caseDetail, navigation, t]);

  const handleGetDirections = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleGetDirections: directions not implemented yet`);
    setNoticeKey('caseDetails.location.directionsComingSoon');
  };

  const handleCallPrimary = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleCallPrimary: masked calling not implemented yet`);
    setNoticeKey('caseDetails.call.comingSoon');
  };

  const handleCallSecondary = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleCallSecondary: masked calling not implemented yet`);
    setNoticeKey('caseDetails.call.comingSoon');
  };

  const handleCaptureSignature = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleCaptureSignature: signature capture not implemented yet`);
    markSignatureCaptured();
    setNoticeKey('caseDetails.residence.signatureComingSoon');
  };

  const handleOpenCamera = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleOpenCamera: camera capture not implemented yet`);
    setNoticeKey('caseDetails.photo.cameraComingSoon');
  };

  const handleSubmit = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleSubmit: submit pressed`, { caseId: params.caseId });
    submit(() => {
      navigation.goBack();
    });
  };

  if (isLoading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" accessibilityLabel={t('caseDetails.loading')} testID="case-details-loading-spinner" />
      </Box>
    );
  }

  if (loadError || !caseDetail) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" p="$5">
        <VStack space="md" alignItems="center">
          <Alert action="error" testID="case-details-error-alert">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t('caseDetails.errors.network')}</AlertText>
          </Alert>
          <Button onPress={refresh} accessibilityLabel={t('caseList.actions.retry')} testID="case-details-retry-button">
            <ButtonText>{t('caseList.actions.retry')}</ButtonText>
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <ScrollView flex={1} contentContainerStyle={{ padding: 16, gap: 12 }} testID="case-details-scroll-view">
      <VStack space="md">
        {noticeKey ? (
          <Alert action="info" testID="case-details-notice">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t(noticeKey)}</AlertText>
          </Alert>
        ) : null}

        <CaseInfoSection caseDetail={caseDetail} />

        <CaseLocationSection
          address={caseDetail.address}
          gpsCheck={caseDetail.gpsCheck}
          onGetDirections={handleGetDirections}
        />

        <CaseMaskedCallSection
          maskedPrimaryPhone={caseDetail.maskedPrimaryPhone}
          maskedSecondaryPhone={caseDetail.maskedSecondaryPhone}
          onCallPrimary={handleCallPrimary}
          onCallSecondary={handleCallSecondary}
        />

        <CaseInstructionsSection
          clientInstructions={caseDetail.clientInstructions}
          fieldExecutiveNotes={caseDetail.fieldExecutiveNotes}
        />

        <CaseVerificationOutcomeSection
          statusOptions={referenceData?.verificationTypeStatuses ?? []}
          verificationStatus={verificationStatus}
          onSelectStatus={selectVerificationStatus}
          isUtvSectionVisible={isUtvSectionVisible}
          utvReasonOptions={referenceData?.utvOptions ?? []}
          utvReason={utvReason}
          onSelectUtvReason={selectUtvReason}
          utvRemarks={utvRemarks}
          onUtvRemarksChange={setUtvRemarks}
          isInsufficientSectionVisible={isInsufficientSectionVisible}
          insufficientReasonOptions={referenceData?.insuffOptions ?? []}
          insufficientReason={insufficientReason}
          onSelectInsufficientReason={selectInsufficientReason}
          insufficientRemarks={insufficientRemarks}
          onInsufficientRemarksChange={setInsufficientRemarks}
        />

        {isVerifiedResidenceSectionVisible ? (
          <CaseVerifiedResidenceSection
            residenceType={residenceType}
            onSelectResidenceType={selectResidenceType}
            addressType={addressType}
            onSelectAddressType={selectAddressType}
            respondentName={respondentName}
            onRespondentNameChange={setRespondentName}
            respondentRelation={respondentRelation}
            onRespondentRelationChange={setRespondentRelation}
            isSignatureCaptured={isSignatureCaptured}
            onCaptureSignature={handleCaptureSignature}
          />
        ) : null}

        <CasePhotoEvidenceSection
          photoTagOptions={referenceData?.photoTypes ?? []}
          selectedPhotoTag={selectedPhotoTag}
          onSelectPhotoTag={selectPhotoTag}
          onOpenCamera={handleOpenCamera}
        />

        {submitError ? (
          <Alert action="error" testID="case-details-submit-error">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t('caseDetails.errors.submitFailed')}</AlertText>
          </Alert>
        ) : null}

        <Button
          action="positive"
          size="lg"
          borderRadius="$xl"
          onPress={handleSubmit}
          isDisabled={isSubmitting}
          accessibilityLabel={t('caseDetails.submit')}
          testID="case-details-submit-button"
        >
          {isSubmitting ? <ButtonSpinner mr="$2" /> : null}
          <ButtonText>{t('caseDetails.submit')}</ButtonText>
        </Button>
      </VStack>
    </ScrollView>
  );
}
