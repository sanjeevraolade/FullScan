import React, { useLayoutEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  AlertCircleIcon,
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogCloseButton,
  AlertDialogBody,
  AlertDialogFooter,
  AlertIcon,
  AlertText,
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  CloseIcon,
  Heading,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';
import type { CapturedPhotoEvidence } from '@/domain/case';

import { CaseInfoSection } from '../components/case-info-section';
import { CaseInstructionsSection } from '../components/case-instructions-section';
import { CaseForceProceedDialog } from '../components/case-force-proceed-dialog';
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
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false);
  const [showForceProceedConsent, setShowForceProceedConsent] = useState(false);
  // Params — not local state — are the source of truth for captured photos:
  // CaseCamera always hands back the complete set (see `CaseDetailsRouteParams`
  // doc), so there's nothing here that could go stale or reset independently.
  const capturedPhotos = useMemo<readonly CapturedPhotoEvidence[]>(() => {
    // File paths are evidence URIs and never logged — only how many there are.
    LoggerService.info(`${FILE_NAME}: capturedPhotos: rehydrating captured photos from params`, {
      count: (params.capturedPhotos ?? []).length,
    });
    return (params.capturedPhotos ?? []).map(({ capturedAtIso, ...rest }) => ({
      ...rest,
      capturedAt: new Date(capturedAtIso),
    }));
  }, [params.capturedPhotos]);
  const {
    caseDetail,
    referenceData,
    isLoading,
    loadError,
    refresh,
    isReadOnly,
    isNewCase,
    shouldShowDetailFormSections,
    acceptCase: acceptCaseAction,
    geoFence,
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
    hasDraft,
    draftSavedAt,
    saveDraft,
  } = useCaseDetails(params.caseId);

  /**
   * The single gate for "show the rest of the case": the geo-fence passed, or
   * the user went through the Force Proceed consent flow.
   */
  const isCaseContentVisible = geoFence.isCaseContentUnlocked;

  LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: rendering`, {
    caseId: params.caseId,
    geoFenceStatus: geoFence.status,
    isCaseContentVisible,
  });

  useLayoutEffect(() => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: header effect running`, {
      hasCaseDetail: caseDetail !== null,
    });
    navigation.setOptions({
      headerTitle: caseDetail ? t('caseDetails.title', { caseRef: caseDetail.caseRef }) : '',
      headerRight: () => {
        LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: rendering header badge`, {
          bucket: caseDetail?.bucket ?? null,
        });
        return caseDetail ? (
          <Badge action="warning" size="sm" borderRadius="$md" mr="$4">
            <BadgeText textTransform="uppercase">{t(`caseList.tabs.${caseDetail.bucket}`)}</BadgeText>
          </Badge>
        ) : null;
      },
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
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleOpenCamera: opening geotagged camera`, {
      caseId: params.caseId,
      photoTagCode: selectedPhotoTag,
    });
    navigation.navigate(ROUTE_NAMES.CASE_CAMERA, {
      caseId: params.caseId,
      photoTagCode: selectedPhotoTag,
      existingPhotos: params.capturedPhotos ?? [],
    });
  };

  const handleDeletePhoto = (filePath: string): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleDeletePhoto: removing captured photo`);
    // Evidence file paths are never logged — counts only.
    const remainingPhotos = (params.capturedPhotos ?? []).filter(
      (photo) => photo.filePath !== filePath,
    );
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleDeletePhoto: photo removed`, {
      caseId: params.caseId,
      previousCount: (params.capturedPhotos ?? []).length,
      remainingCount: remainingPhotos.length,
    });
    navigation.setParams({
      capturedPhotos: remainingPhotos,
    });
  };

  const handleRecalculateDistance = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleRecalculateDistance: recalculating`, {
      caseId: params.caseId,
    });
    void geoFence.recalculate();
  };

  const handleForceProceedPress = (): void => {
    LoggerService.warn(
      `${FILE_NAME}: CaseDetailsScreen.handleForceProceedPress: showing bypass consent dialog`,
      { caseId: params.caseId },
    );
    setShowForceProceedConsent(true);
  };

  const handleForceProceedCancelled = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleForceProceedCancelled: bypass declined`, {
      caseId: params.caseId,
    });
    setShowForceProceedConsent(false);
  };

  const handleForceProceedAgreed = (): void => {
    LoggerService.warn(`${FILE_NAME}: CaseDetailsScreen.handleForceProceedAgreed: bypass consented`, {
      caseId: params.caseId,
    });
    setShowForceProceedConsent(false);
    geoFence.confirmForceProceed();
  };

  const handleAcceptPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleAcceptPress: showing confirmation dialog`, {
      caseId: params.caseId,
    });
    setShowAcceptConfirmation(true);
  };

  const handleAcceptConfirmed = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleAcceptConfirmed: accept confirmed`, {
      caseId: params.caseId,
    });
    setShowAcceptConfirmation(false);
    acceptCaseAction(() => {
      LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleAcceptConfirmed: refreshing case after acceptance`, {
        caseId: params.caseId,
      });
      refresh();
    });
  };

  const handleSaveDraft = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleSaveDraft: saving draft`, {
      caseId: params.caseId,
    });
    // The draft timestamp line below Case Ref is the confirmation — no banner.
    saveDraft();
  };

  const handleSubmit = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleSubmit: submit pressed`, { caseId: params.caseId });
    submit(() => {
      LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleSubmit: submitted — navigating back`, {
        caseId: params.caseId,
      });
      navigation.goBack();
    });
  };

  if (isLoading) {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: rendering loading state`, {
      caseId: params.caseId,
    });
    return (
      <Box flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" accessibilityLabel={t('caseDetails.loading')} testID="case-details-loading-spinner" />
      </Box>
    );
  }

  if (loadError || !caseDetail) {
    LoggerService.warn(`${FILE_NAME}: CaseDetailsScreen: rendering load-error state`, {
      caseId: params.caseId,
      loadError,
      hasCaseDetail: caseDetail !== null,
    });
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

  LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: rendering case body`, {
    caseId: params.caseId,
    bucket: caseDetail.bucket,
    isNewCase,
    isReadOnly,
    isCaseContentVisible,
    shouldShowDetailFormSections,
    isUtvSectionVisible,
    isInsufficientSectionVisible,
    isVerifiedResidenceSectionVisible,
    hasNotice: noticeKey !== null,
    hasSubmitError: submitError !== null,
    capturedPhotoCount: capturedPhotos.length,
  });

  return (
    <ScrollView flex={1} contentContainerStyle={{ padding: 16, gap: 12 }} testID="case-details-scroll-view">
      <VStack space="md">
        {hasDraft && draftSavedAt ? (
          <Text
            size="xs"
            color="$textLight500"
            sx={{ _dark: { color: '$textDark400' } }}
            testID="case-details-draft-status"
          >
            {t('caseDetails.draft.saved', {
              time: new Date(draftSavedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </Text>
        ) : null}

        {noticeKey ? (
          <Alert action="info" testID="case-details-notice">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t(noticeKey)}</AlertText>
          </Alert>
        ) : null}

        <CaseInfoSection caseDetail={caseDetail} />

        <CaseLocationSection
          address={caseDetail.address}
          caseCoordinates={geoFence.caseCoordinates}
          geoFenceStatus={geoFence.status}
          distanceMeters={geoFence.distanceMeters}
          distanceMethod={geoFence.distanceMethod}
          radiusMeters={geoFence.radiusMeters}
          isCaseLocationFromCache={geoFence.isCaseLocationFromCache}
          unresolvedReason={geoFence.unresolvedReason}
          remainingAttempts={geoFence.remainingAttempts}
          canForceProceed={geoFence.canForceProceed}
          isGeoFenceBypassed={geoFence.bypassConsent !== null}
          isBusy={geoFence.isBusy}
          onGetDirections={handleGetDirections}
          onRecalculate={handleRecalculateDistance}
          onForceProceedPress={handleForceProceedPress}
        />

        {/*
          Everything below Case Location is gated on the geo-fence: until the
          field executive is inside the configured radius (or has explicitly
          consented to bypass it), Case Information and Case Location are the
          entire screen. Accepting a *new* case stays available — that happens
          before the executive travels to the address, so it can't require
          being there.
        */}
        {isCaseContentVisible ? (
          <>
            {!isNewCase ? (
              <>
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
              </>
            ) : null}

            {shouldShowDetailFormSections ? (
              <>
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
                  isReadOnly={isReadOnly}
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
                    isReadOnly={isReadOnly}
                  />
                ) : null}

                <CasePhotoEvidenceSection
                  photoTagOptions={referenceData?.photoTypes ?? []}
                  selectedPhotoTag={selectedPhotoTag}
                  onSelectPhotoTag={selectPhotoTag}
                  onOpenCamera={handleOpenCamera}
                  capturedPhotos={capturedPhotos}
                  onDeletePhoto={handleDeletePhoto}
                  isReadOnly={isReadOnly}
                />
              </>
            ) : null}
          </>
        ) : null}

        {submitError ? (
          <Alert action="error" testID="case-details-submit-error">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t('caseDetails.errors.submitFailed')}</AlertText>
          </Alert>
        ) : null}

        {isNewCase ? (
          <Button
            action="positive"
            size="lg"
            borderRadius="$xl"
            onPress={handleAcceptPress}
            isDisabled={isSubmitting}
            accessibilityLabel={t('caseList.actions.accept')}
            testID="case-details-accept-button"
          >
            {isSubmitting ? <ButtonSpinner mr="$2" /> : null}
            <ButtonText>{t('caseList.actions.accept')}</ButtonText>
          </Button>
        ) : isReadOnly ? (
          <Alert action="info" testID="case-details-read-only-notice">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t('caseDetails.readOnly.message')}</AlertText>
          </Alert>
        ) : isCaseContentVisible ? (
          <VStack space="md">
            <Button
              action="secondary"
              size="lg"
              borderRadius="$xl"
              onPress={handleSaveDraft}
              isDisabled={isSubmitting}
              accessibilityLabel={t('caseDetails.saveDraft')}
              testID="case-details-save-draft-button"
            >
              <ButtonText>{t('caseDetails.saveDraft')}</ButtonText>
            </Button>
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
        ) : null}
      </VStack>

      <CaseForceProceedDialog
        isOpen={showForceProceedConsent}
        onCancel={handleForceProceedCancelled}
        onAgree={handleForceProceedAgreed}
      />

      <AlertDialog
        isOpen={showAcceptConfirmation}
        onClose={() => {
          LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: accept dialog dismissed`, {
            caseId: params.caseId,
          });
          setShowAcceptConfirmation(false);
        }}
        testID="case-details-accept-confirmation-dialog"
      >
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="lg" fontWeight="$bold">
              {t('caseList.actions.accept')}
            </Heading>
            <AlertDialogCloseButton
              onPress={() => {
                LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: accept dialog closed`, {
                  caseId: params.caseId,
                });
                setShowAcceptConfirmation(false);
              }}
            >
              <CloseIcon />
            </AlertDialogCloseButton>
          </AlertDialogHeader>
          <AlertDialogBody mt="$3" mb="$4">
            <AlertText>{t('caseDetails.acceptConfirmation.message')}</AlertText>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              variant="outline"
              action="secondary"
              mr="$3"
              onPress={() => {
                LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: accept cancelled`, {
                  caseId: params.caseId,
                });
                setShowAcceptConfirmation(false);
              }}
              testID="case-details-accept-cancel-button"
            >
              <ButtonText>{t('caseList.actions.cancel')}</ButtonText>
            </Button>
            <Button
              action="positive"
              onPress={handleAcceptConfirmed}
              isDisabled={isSubmitting}
              testID="case-details-accept-confirm-button"
            >
              {isSubmitting ? <ButtonSpinner mr="$2" /> : null}
              <ButtonText>{t('caseList.actions.accept')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  );
}
