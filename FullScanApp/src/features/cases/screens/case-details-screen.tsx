import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationAction, RouteProp } from '@react-navigation/native';
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
import type { RootStackParamList, SerializedCapturedPhotoEvidence } from '@/navigation/routes';
import type { CapturedPhotoEvidence } from '@/domain/case';

import { CaseInfoSection } from '../components/case-info-section';
import { CaseInstructionsSection } from '../components/case-instructions-section';
import { CaseForceProceedDialog } from '../components/case-force-proceed-dialog';
import { CaseLocationSection } from '../components/case-location-section';
import { CaseMaskedCallSection } from '../components/case-masked-call-section';
import { CasePhotoEvidenceSection } from '../components/case-photo-evidence-section';
import { CaseVerificationOutcomeSection } from '../components/case-verification-outcome-section';
import { CaseUnsavedChangesDialog } from '../components/case-unsaved-changes-dialog';
import { CaseVerifiedResidenceSection } from '../components/case-verified-residence-section';
import { useCaseDetails } from '../hooks/use-case-details';
import type { CaseDetailsSubmitErrorKey } from '../hooks/use-case-details';
import { toCapturedPhotoEvidence } from '../utils/captured-photo-serialization';

const FILE_NAME = 'case-details-screen.tsx';

/** Stable empty list, so a case with no captured evidence does not churn the hook's inputs. */
const NO_CAPTURED_PHOTOS: readonly SerializedCapturedPhotoEvidence[] = [];

/** The message shown for each way Accept/Submit can fail. */
const SUBMIT_ERROR_MESSAGE_KEYS: Readonly<Record<CaseDetailsSubmitErrorKey, string>> = {
  network: 'caseDetails.errors.submitFailed',
  evidenceCaseClosed: 'caseDetails.errors.evidenceCaseClosed',
  evidenceUploadFailed: 'caseDetails.errors.evidenceUploadFailed',
};

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
  /*
   * The back/pop action held back while the unsaved-changes dialog is up. It
   * is re-dispatched verbatim on Discard so the user lands wherever they were
   * actually heading — header back, hardware back or a swipe.
   */
  const [pendingExitAction, setPendingExitAction] = useState<NavigationAction | null>(null);
  /*
   * A ref, not state: the `beforeRemove` listener has to see this the moment
   * it is set (during the same dispatch), which a state update cannot promise.
   */
  const isExitConfirmedRef = useRef(false);
  // Params — not local state — are the source of truth for captured photos:
  // CaseCamera always hands back the complete set (see `CaseDetailsRouteParams`
  // doc), so there's nothing here that could go stale or reset independently.
  const serializedCapturedPhotos = params.capturedPhotos ?? NO_CAPTURED_PHOTOS;
  const capturedPhotos = useMemo<readonly CapturedPhotoEvidence[]>(() => {
    // File paths are evidence URIs and never logged — only how many there are.
    LoggerService.info(`${FILE_NAME}: capturedPhotos: rehydrating captured photos from params`, {
      count: serializedCapturedPhotos.length,
    });
    return serializedCapturedPhotos.map(toCapturedPhotoEvidence);
  }, [serializedCapturedPhotos]);
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
    evidenceUploadProgress,
    submitError,
    submit,
    hasDraft,
    draftSavedAt,
    saveDraft,
    draftPhotosToRestore,
    hasUnsavedChanges,
  } = useCaseDetails(params.caseId, serializedCapturedPhotos);

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

  /*
   * Photos restored from a draft have to go back into the navigation params,
   * which are this screen's source of truth for captured evidence. Runs once
   * per restore — the hook stops offering them as soon as they are back.
   */
  useEffect(() => {
    if (draftPhotosToRestore === null) {
      LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: no draft photos to restore`, {
        caseId: params.caseId,
      });
      return;
    }
    if (serializedCapturedPhotos.length > 0) {
      LoggerService.info(
        `${FILE_NAME}: CaseDetailsScreen: keeping this session's photos over the draft's`,
        { caseId: params.caseId, count: serializedCapturedPhotos.length },
      );
      return;
    }
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: restoring draft photos into params`, {
      caseId: params.caseId,
      count: draftPhotosToRestore.length,
    });
    navigation.setParams({ capturedPhotos: draftPhotosToRestore });
  }, [draftPhotosToRestore, navigation, params.caseId, serializedCapturedPhotos.length]);

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: back-guard effect running`, {
      caseId: params.caseId,
      hasUnsavedChanges,
    });
    const unsubscribeFromBeforeRemove = navigation.addListener('beforeRemove', (event) => {
      if (isExitConfirmedRef.current || !hasUnsavedChanges) {
        LoggerService.info(`${FILE_NAME}: CaseDetailsScreen: leaving case without prompting`, {
          caseId: params.caseId,
          isExitConfirmed: isExitConfirmedRef.current,
          hasUnsavedChanges,
        });
        return;
      }
      LoggerService.warn(
        `${FILE_NAME}: CaseDetailsScreen: back blocked — unsaved answers, asking for confirmation`,
        { caseId: params.caseId },
      );
      event.preventDefault();
      setPendingExitAction(event.data.action);
    });
    return unsubscribeFromBeforeRemove;
  }, [hasUnsavedChanges, navigation, params.caseId]);

  const handleKeepEditing = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleKeepEditing: staying on the case`, {
      caseId: params.caseId,
    });
    setPendingExitAction(null);
  }, [params.caseId]);

  const handleDiscardChanges = useCallback((): void => {
    if (pendingExitAction === null) {
      LoggerService.warn(
        `${FILE_NAME}: CaseDetailsScreen.handleDiscardChanges: no pending exit action to replay`,
        { caseId: params.caseId },
      );
      return;
    }
    LoggerService.warn(
      `${FILE_NAME}: CaseDetailsScreen.handleDiscardChanges: discarding unsaved answers and leaving`,
      { caseId: params.caseId },
    );
    // Let the very next `beforeRemove` through, then replay the original
    // action so back / swipe / hardware back all land where they meant to.
    isExitConfirmedRef.current = true;
    setPendingExitAction(null);
    navigation.dispatch(pendingExitAction);
  }, [navigation, params.caseId, pendingExitAction]);

  const handleSaveDraftAndExit = useCallback((): void => {
    if (pendingExitAction === null) {
      LoggerService.warn(
        `${FILE_NAME}: CaseDetailsScreen.handleSaveDraftAndExit: no pending exit action to replay`,
        { caseId: params.caseId },
      );
      return;
    }
    LoggerService.info(
      `${FILE_NAME}: CaseDetailsScreen.handleSaveDraftAndExit: saving draft before leaving`,
      { caseId: params.caseId },
    );
    // Synchronous local write — the draft is on disk before the screen pops.
    saveDraft();
    isExitConfirmedRef.current = true;
    setPendingExitAction(null);
    navigation.dispatch(pendingExitAction);
  }, [navigation, params.caseId, pendingExitAction, saveDraft]);

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

  /*
   * While photos upload the button reports how far it has got, so a slow
   * connection reads as progress rather than a hung submit. The label doubles
   * as the accessibility label, so screen readers hear the same progress.
   */
  const submitButtonLabel = evidenceUploadProgress
    ? t('caseDetails.uploadingPhotos', {
        uploadedCount: evidenceUploadProgress.uploadedCount,
        totalCount: evidenceUploadProgress.totalCount,
      })
    : t('caseDetails.submit');

  const handleSubmit = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleSubmit: submit pressed`, { caseId: params.caseId });
    submit(() => {
      LoggerService.info(`${FILE_NAME}: CaseDetailsScreen.handleSubmit: submitted — navigating back`, {
        caseId: params.caseId,
      });
      // The answers are with the backend now — no discard prompt on the way out.
      isExitConfirmedRef.current = true;
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
    hasUnsavedChanges,
    hasNotice: noticeKey !== null,
    hasSubmitError: submitError !== null,
    submitError,
    isUploadingEvidence: evidenceUploadProgress !== null,
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
                  isReadOnly={isReadOnly}
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
            <AlertText>{t(SUBMIT_ERROR_MESSAGE_KEYS[submitError])}</AlertText>
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
              accessibilityLabel={submitButtonLabel}
              testID="case-details-submit-button"
            >
              {isSubmitting ? <ButtonSpinner mr="$2" /> : null}
              <ButtonText>{submitButtonLabel}</ButtonText>
            </Button>
          </VStack>
        ) : null}
      </VStack>

      <CaseForceProceedDialog
        isOpen={showForceProceedConsent}
        onCancel={handleForceProceedCancelled}
        onAgree={handleForceProceedAgreed}
      />

      <CaseUnsavedChangesDialog
        isOpen={pendingExitAction !== null}
        onKeepEditing={handleKeepEditing}
        onSaveDraft={handleSaveDraftAndExit}
        onDiscard={handleDiscardChanges}
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
