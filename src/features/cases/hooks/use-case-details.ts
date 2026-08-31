import { useCallback, useEffect, useMemo, useState } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { acceptCase as acceptCaseApi, fetchCaseDetail, submitVerificationOutcome } from '@/repositories/case-repository';
import {
  VERIFICATION_STATUS_INSUFFICIENT,
  VERIFICATION_STATUS_UTV,
  VERIFICATION_STATUS_VERIFIED_CLEAR,
} from '@/domain/case';
import type { AddressType, CaseDetail, ResidenceType } from '@/domain/case';
import { useReferenceDataStore } from '@/store/reference-data';
import type { ReferenceData } from '@/domain/reference-data';
import {
  isReadOnlyCaseBucket,
  isNewCaseBucket,
  shouldShowDetailFormSections,
} from '../utils/case-access-control';

const FILE_NAME = 'use-case-details.ts';

const DEFAULT_RESIDENCE_TYPE: ResidenceType = 'rented';
const DEFAULT_ADDRESS_TYPE: AddressType = 'present';

export type CaseDetailsLoadErrorKey = 'network';
export type CaseDetailsSubmitErrorKey = 'network';

export interface UseCaseDetailsResult {
  readonly caseDetail: CaseDetail | null;
  readonly referenceData: ReferenceData | null;
  readonly isLoading: boolean;
  readonly loadError: CaseDetailsLoadErrorKey | null;
  readonly refresh: () => void;
  readonly isReadOnly: boolean;
  readonly isNewCase: boolean;
  readonly shouldShowDetailFormSections: boolean;
  readonly acceptCase: (onAccepted: () => void) => void;

  readonly verificationStatus: string;
  readonly selectVerificationStatus: (status: string) => void;
  readonly isUtvSectionVisible: boolean;
  readonly utvReason: string;
  readonly selectUtvReason: (reason: string) => void;
  readonly utvRemarks: string;
  readonly setUtvRemarks: (remarks: string) => void;
  readonly isInsufficientSectionVisible: boolean;
  readonly insufficientReason: string;
  readonly selectInsufficientReason: (reason: string) => void;
  readonly insufficientRemarks: string;
  readonly setInsufficientRemarks: (remarks: string) => void;

  readonly isVerifiedResidenceSectionVisible: boolean;
  readonly residenceType: ResidenceType;
  readonly selectResidenceType: (type: ResidenceType) => void;
  readonly addressType: AddressType;
  readonly selectAddressType: (type: AddressType) => void;
  readonly respondentName: string;
  readonly setRespondentName: (name: string) => void;
  readonly respondentRelation: string;
  readonly setRespondentRelation: (relation: string) => void;
  readonly isSignatureCaptured: boolean;
  readonly markSignatureCaptured: () => void;

  readonly selectedPhotoTag: string;
  readonly selectPhotoTag: (tag: string) => void;

  readonly isSubmitting: boolean;
  readonly submitError: CaseDetailsSubmitErrorKey | null;
  readonly submit: (onSubmitted: () => void) => void;
}

/**
 * Owns the Case Details screen's data: the fetched `CaseDetail` plus every
 * piece of the verification-outcome form (status, UTV/Insufficient reasons,
 * verified-residence fields, selected photo tag). Screens read from this
 * hook only — no networking or business rules (e.g. which sections a status
 * reveals) happen in the screen.
 */
export function useCaseDetails(caseId: string): UseCaseDetailsResult {
  const referenceData = useReferenceDataStore((state) => state.referenceData);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<CaseDetailsLoadErrorKey | null>(null);

  const [verificationStatus, setVerificationStatus] = useState('');
  const [utvReason, setUtvReason] = useState('');
  const [utvRemarks, setUtvRemarks] = useState('');
  const [insufficientReason, setInsufficientReason] = useState('');
  const [insufficientRemarks, setInsufficientRemarks] = useState('');
  const [residenceType, setResidenceType] = useState<ResidenceType>(DEFAULT_RESIDENCE_TYPE);
  const [addressType, setAddressType] = useState<AddressType>(DEFAULT_ADDRESS_TYPE);
  const [respondentName, setRespondentName] = useState('');
  const [respondentRelation, setRespondentRelation] = useState('');
  const [isSignatureCaptured, setIsSignatureCaptured] = useState(false);
  const [selectedPhotoTag, setSelectedPhotoTag] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<CaseDetailsSubmitErrorKey | null>(null);

  const loadCaseDetail = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: loadCaseDetail: fetching`, { caseId });
    setIsLoading(true);
    setLoadError(null);

    fetchCaseDetail(caseId)
      .then((detail) => {
        setCaseDetail(detail);
        setVerificationStatus(detail.selectedVerificationStatus ?? referenceData?.verificationTypeStatuses[0]?.code ?? '');
        setRespondentName(detail.respondent?.name ?? '');
        setRespondentRelation(detail.respondent?.relation ?? '');
        setSelectedPhotoTag(referenceData?.photoTypes[0]?.code ?? '');
        LoggerService.info(`${FILE_NAME}: loadCaseDetail: loaded`, { caseId });
      })
      .catch((error: unknown) => {
        LoggerService.error(`${FILE_NAME}: loadCaseDetail: failed`, {
          caseId,
          reason: error instanceof Error ? error.message : 'unknown error',
        });
        setLoadError('network');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [caseId, referenceData]);

  useEffect(() => {
    loadCaseDetail();
  }, [loadCaseDetail]);

  const selectVerificationStatus = useCallback((status: string): void => {
    LoggerService.info(`${FILE_NAME}: selectVerificationStatus: status changed`, { status });
    setVerificationStatus(status);
  }, []);

  const selectUtvReason = useCallback((reason: string): void => {
    setUtvReason(reason);
  }, []);

  const selectInsufficientReason = useCallback((reason: string): void => {
    setInsufficientReason(reason);
  }, []);

  const selectResidenceType = useCallback((type: ResidenceType): void => {
    setResidenceType(type);
  }, []);

  const selectAddressType = useCallback((type: AddressType): void => {
    setAddressType(type);
  }, []);

  const markSignatureCaptured = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: markSignatureCaptured: signature captured`, { caseId });
    setIsSignatureCaptured(true);
  }, [caseId]);

  const selectPhotoTag = useCallback((tag: string): void => {
    setSelectedPhotoTag(tag);
  }, []);

  const isReadOnly = useMemo(
    () => (caseDetail ? isReadOnlyCaseBucket(caseDetail.bucket) : false),
    [caseDetail],
  );

  const isNewCaseValue = useMemo(
    () => (caseDetail ? isNewCaseBucket(caseDetail.bucket) : false),
    [caseDetail],
  );

  const shouldShowDetailFormSectionsValue = useMemo(
    () => (caseDetail ? shouldShowDetailFormSections(caseDetail.bucket) : false),
    [caseDetail],
  );

  const acceptCase = useCallback(
    (onAccepted: () => void): void => {
      LoggerService.info(`${FILE_NAME}: acceptCase: accepting new case`, { caseId });
      setIsSubmitting(true);
      setSubmitError(null);

      acceptCaseApi(caseId)
        .then(() => {
          LoggerService.info(`${FILE_NAME}: acceptCase: case accepted`, { caseId });
          onAccepted();
        })
        .catch((error: unknown) => {
          LoggerService.error(`${FILE_NAME}: acceptCase: failed`, {
            caseId,
            reason: error instanceof Error ? error.message : 'unknown error',
          });
          setSubmitError('network');
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    },
    [caseId],
  );

  const isUtvSectionVisible = verificationStatus === VERIFICATION_STATUS_UTV;
  const isInsufficientSectionVisible = verificationStatus === VERIFICATION_STATUS_INSUFFICIENT;
  const isVerifiedResidenceSectionVisible =
    verificationStatus === VERIFICATION_STATUS_VERIFIED_CLEAR && caseDetail?.gpsCheck.isWithinRange === true;

  const submit = useCallback(
    (onSubmitted: () => void): void => {
      LoggerService.info(`${FILE_NAME}: submit: submitting verification outcome`, { caseId, verificationStatus });
      setIsSubmitting(true);
      setSubmitError(null);

      submitVerificationOutcome(caseId, {
        verificationStatus,
        utvReason: isUtvSectionVisible ? utvReason || null : null,
        utvRemarks: isUtvSectionVisible ? utvRemarks || null : null,
        insufficientReason: isInsufficientSectionVisible ? insufficientReason || null : null,
        insufficientRemarks: isInsufficientSectionVisible ? insufficientRemarks || null : null,
        residenceType: isVerifiedResidenceSectionVisible ? residenceType : null,
        addressType: isVerifiedResidenceSectionVisible ? addressType : null,
        respondent: isVerifiedResidenceSectionVisible ? { name: respondentName, relation: respondentRelation } : null,
        isSignatureCaptured,
      })
        .then(() => {
          LoggerService.info(`${FILE_NAME}: submit: outcome submitted`, { caseId });
          onSubmitted();
        })
        .catch((error: unknown) => {
          LoggerService.error(`${FILE_NAME}: submit: failed`, {
            caseId,
            reason: error instanceof Error ? error.message : 'unknown error',
          });
          setSubmitError('network');
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    },
    [
      addressType,
      caseId,
      insufficientReason,
      insufficientRemarks,
      isInsufficientSectionVisible,
      isSignatureCaptured,
      isUtvSectionVisible,
      isVerifiedResidenceSectionVisible,
      respondentName,
      respondentRelation,
      residenceType,
      utvReason,
      utvRemarks,
      verificationStatus,
    ],
  );

  return {
    caseDetail,
    referenceData,
    isLoading,
    loadError,
    refresh: loadCaseDetail,
    isReadOnly,
    isNewCase: isNewCaseValue,
    shouldShowDetailFormSections: shouldShowDetailFormSectionsValue,
    acceptCase,

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
  };
}
