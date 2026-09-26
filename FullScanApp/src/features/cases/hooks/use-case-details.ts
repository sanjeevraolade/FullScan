import { useCallback, useEffect, useMemo, useState } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { acceptCase as acceptCaseApi, fetchCaseDetail, submitVerificationOutcome } from '@/repositories/case-repository';
import {
  VERIFICATION_STATUS_INSUFFICIENT,
  VERIFICATION_STATUS_UTV,
  VERIFICATION_STATUS_VERIFIED_CLEAR,
} from '@/domain/case';
import type { AddressType, CaseDetail, ResidenceType } from '@/domain/case';
import type { SerializedCapturedPhotoEvidence } from '@/navigation/routes';
import { useReferenceDataStore } from '@/store/reference-data';
import { useLocationStore } from '@/store/location';
import type { ReferenceData } from '@/domain/reference-data';
import {
  isReadOnlyCaseBucket,
  isNewCaseBucket,
  shouldShowDetailFormSections,
} from '../utils/case-access-control';
import { useCaseGeoFence } from './use-case-geo-fence';
import type { UseCaseGeoFenceResult } from './use-case-geo-fence';
import { DraftStorageService } from '../services/draft-storage';

const FILE_NAME = 'use-case-details.ts';

const DEFAULT_RESIDENCE_TYPE: ResidenceType = 'rented';
const DEFAULT_ADDRESS_TYPE: AddressType = 'present';

/**
 * The editable verification-outcome fields of a case, captured as one value so
 * the current form can be compared against the last saved state. Photo
 * evidence is deliberately not part of it: captured photos live in navigation
 * params, and the screen folds them into its own unsaved-changes check.
 */
interface CaseFormSnapshot {
  readonly verificationStatus: string;
  readonly utvReason: string;
  readonly utvRemarks: string;
  readonly insufficientReason: string;
  readonly insufficientRemarks: string;
  readonly residenceType: ResidenceType;
  readonly addressType: AddressType;
  readonly respondentName: string;
  readonly respondentRelation: string;
  readonly isSignatureCaptured: boolean;
  readonly selectedPhotoTag: string;
}

/**
 * Whether two form snapshots hold the same answers. Field-by-field rather than
 * a serialized comparison so a future field can never silently escape the
 * unsaved-changes check.
 */
function areFormSnapshotsEqual(left: CaseFormSnapshot, right: CaseFormSnapshot): boolean {
  const isEqual =
    left.verificationStatus === right.verificationStatus &&
    left.utvReason === right.utvReason &&
    left.utvRemarks === right.utvRemarks &&
    left.insufficientReason === right.insufficientReason &&
    left.insufficientRemarks === right.insufficientRemarks &&
    left.residenceType === right.residenceType &&
    left.addressType === right.addressType &&
    left.respondentName === right.respondentName &&
    left.respondentRelation === right.respondentRelation &&
    left.isSignatureCaptured === right.isSignatureCaptured &&
    left.selectedPhotoTag === right.selectedPhotoTag;
  // Field values are respondent PII — only the verdict is logged.
  LoggerService.info(`${FILE_NAME}: areFormSnapshotsEqual: compared form snapshots`, { isEqual });
  return isEqual;
}

/**
 * A comparable fingerprint of a case's captured evidence, so photos count
 * towards unsaved changes without the snapshot having to deep-compare them.
 * Order-independent: the same photos in a different order are the same
 * evidence. File paths are the identity here and are never logged.
 */
function buildCapturedPhotoKey(capturedPhotos: readonly SerializedCapturedPhotoEvidence[]): string {
  LoggerService.info(`${FILE_NAME}: buildCapturedPhotoKey: fingerprinting captured photos`, {
    count: capturedPhotos.length,
  });
  return capturedPhotos
    .map((photo) => `${photo.filePath}|${photo.documentTypeCode}`)
    .slice()
    .sort()
    .join('\n');
}

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
  /**
   * The Case Location geo-fence check. Everything below the Case Location
   * section stays hidden until `geoFence.isCaseContentUnlocked` is true.
   */
  readonly geoFence: UseCaseGeoFenceResult;
  /** Whether this case has a saved draft. */
  readonly hasDraft: boolean;
  /** ISO timestamp of when the draft was last saved, or null if no draft. */
  readonly draftSavedAt: string | null;
  /** Save the current form state — captured photos included — as a draft. */
  readonly saveDraft: () => void;
  /**
   * Photos held in a restored draft that the screen has not yet put back into
   * its navigation params, or null when there is nothing to restore. The
   * screen owns the params, so it performs the hand-back.
   */
  readonly draftPhotosToRestore: readonly SerializedCapturedPhotoEvidence[] | null;
  /** Clear the saved draft for this case. */
  readonly clearDraft: () => void;
  /**
   * Whether the form or the captured evidence holds anything that is not in
   * the saved draft (or, for a case opened without one, not in what the
   * backend returned). Drives the back-navigation confirmation — a read-only
   * or not-yet-accepted case is never dirty.
   */
  readonly hasUnsavedChanges: boolean;

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
export function useCaseDetails(
  caseId: string,
  capturedPhotos: readonly SerializedCapturedPhotoEvidence[],
): UseCaseDetailsResult {
  LoggerService.info(`${FILE_NAME}: useCaseDetails: hook invoked`, {
    caseId,
    capturedPhotoCount: capturedPhotos.length,
  });
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

  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  /*
   * The form as it stood at the last point it was persisted — the freshly
   * loaded case, the restored draft, or the last "Save as Draft". Everything
   * typed after that is an unsaved change.
   */
  const [baselineSnapshot, setBaselineSnapshot] = useState<CaseFormSnapshot | null>(null);
  /** The captured-evidence fingerprint as of that same saved baseline. */
  const [baselinePhotoKey, setBaselinePhotoKey] = useState('');
  const [draftPhotosToRestore, setDraftPhotosToRestore] = useState<
    readonly SerializedCapturedPhotoEvidence[] | null
  >(null);

  const capturedPhotoKey = useMemo(
    () => buildCapturedPhotoKey(capturedPhotos),
    [capturedPhotos],
  );

  /**
   * Push a snapshot into the form and treat it as the new saved baseline.
   * Used by both entry points into the form — the initial load and a restored
   * draft — so neither can leave the screen looking dirty before the field
   * executive has touched anything.
   */
  const applyFormSnapshot = useCallback(
    (snapshot: CaseFormSnapshot, photoKey: string): void => {
      LoggerService.info(`${FILE_NAME}: applyFormSnapshot: applying form snapshot as baseline`, {
        caseId,
        verificationStatus: snapshot.verificationStatus,
        selectedPhotoTag: snapshot.selectedPhotoTag,
      });
      setVerificationStatus(snapshot.verificationStatus);
      setUtvReason(snapshot.utvReason);
      setUtvRemarks(snapshot.utvRemarks);
      setInsufficientReason(snapshot.insufficientReason);
      setInsufficientRemarks(snapshot.insufficientRemarks);
      setResidenceType(snapshot.residenceType);
      setAddressType(snapshot.addressType);
      setRespondentName(snapshot.respondentName);
      setRespondentRelation(snapshot.respondentRelation);
      setIsSignatureCaptured(snapshot.isSignatureCaptured);
      setSelectedPhotoTag(snapshot.selectedPhotoTag);
      setBaselineSnapshot(snapshot);
      setBaselinePhotoKey(photoKey);
    },
    [caseId],
  );

  const loadCaseDetail = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: loadCaseDetail: fetching`, { caseId });
    setIsLoading(true);
    setLoadError(null);

    fetchCaseDetail(caseId)
      .then((detail) => {
        LoggerService.info(`${FILE_NAME}: loadCaseDetail: applying loaded detail`, {
          caseId,
          bucket: detail.bucket,
          hasSelectedVerificationStatus: detail.selectedVerificationStatus !== null,
          hasRespondent: detail.respondent !== null,
          hasCaseCoordinates: detail.coordinates !== null,
          addressLength: detail.address.length,
          siblingComponentCount: detail.siblingComponents.length,
        });
        if (detail.coordinates === null) {
          LoggerService.warn(
            `${FILE_NAME}: loadCaseDetail: case carries no coordinates — geo-fence will geocode the address`,
            { caseId, addressLength: detail.address.length },
          );
        }
        if (referenceData === null) {
          LoggerService.warn(`${FILE_NAME}: loadCaseDetail: reference data not available yet`, {
            caseId,
          });
        } else {
          LoggerService.info(`${FILE_NAME}: loadCaseDetail: reference data available`, {
            caseId,
            verificationStatusCount: referenceData.verificationTypeStatuses.length,
            photoTypeCount: referenceData.photoTypes.length,
          });
        }
        setCaseDetail(detail);
        LoggerService.info(`${FILE_NAME}: case detail: case detail applied`, { detail });
        applyFormSnapshot({
          verificationStatus:
            detail.selectedVerificationStatus ?? referenceData?.verificationTypeStatuses[0]?.code ?? '',
          utvReason: '',
          utvRemarks: '',
          insufficientReason: '',
          insufficientRemarks: '',
          residenceType: DEFAULT_RESIDENCE_TYPE,
          addressType: DEFAULT_ADDRESS_TYPE,
          respondentName: detail.respondent?.name ?? '',
          respondentRelation: detail.respondent?.relation ?? '',
          isSignatureCaptured: false,
          selectedPhotoTag: referenceData?.photoTypes[0]?.code ?? '',
          /*
           * Deliberately empty rather than whatever the screen currently
           * holds: a case that arrives with photos — a re-mount on the way
           * back from the camera — is carrying evidence nothing has saved
           * yet, and losing it silently is the whole point of the guard.
           */
        }, '');
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
        LoggerService.info(`${FILE_NAME}: loadCaseDetail: fetch settled`, { caseId });
        setIsLoading(false);
      });
  }, [applyFormSnapshot, caseId, referenceData]);

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: useCaseDetails: load effect running`);
    loadCaseDetail();
  }, [loadCaseDetail]);

  const selectVerificationStatus = useCallback((status: string): void => {
    LoggerService.info(`${FILE_NAME}: selectVerificationStatus: status changed`, { status });
    setVerificationStatus(status);
  }, []);

  const selectUtvReason = useCallback((reason: string): void => {
    LoggerService.info(`${FILE_NAME}: selectUtvReason: utv reason changed`, { reason });
    setUtvReason(reason);
  }, []);

  const selectInsufficientReason = useCallback((reason: string): void => {
    LoggerService.info(`${FILE_NAME}: selectInsufficientReason: insufficient reason changed`, {
      reason,
    });
    setInsufficientReason(reason);
  }, []);

  const selectResidenceType = useCallback((type: ResidenceType): void => {
    LoggerService.info(`${FILE_NAME}: selectResidenceType: residence type changed`, { type });
    setResidenceType(type);
  }, []);

  const selectAddressType = useCallback((type: AddressType): void => {
    LoggerService.info(`${FILE_NAME}: selectAddressType: address type changed`, { type });
    setAddressType(type);
  }, []);

  const markSignatureCaptured = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: markSignatureCaptured: signature captured`, { caseId });
    setIsSignatureCaptured(true);
  }, [caseId]);

  const selectPhotoTag = useCallback((tag: string): void => {
    LoggerService.info(`${FILE_NAME}: selectPhotoTag: photo tag changed`, { tag });
    setSelectedPhotoTag(tag);
  }, []);

  useEffect(() => {
    if (!caseDetail) return;
    // A completed case shows what was submitted — a leftover local draft must never overlay it.
    if (isReadOnlyCaseBucket(caseDetail.bucket)) {
      LoggerService.info(`${FILE_NAME}: useCaseDetails: read-only case — skipping draft restore`, { caseId });
      setHasDraft(false);
      setDraftSavedAt(null);
      setDraftPhotosToRestore(null);
      return;
    }
    LoggerService.info(`${FILE_NAME}: useCaseDetails: checking for draft`, { caseId });
    const draft = DraftStorageService.loadDraft(caseId);
    if (draft) {
      LoggerService.info(`${FILE_NAME}: useCaseDetails: restoring draft`, {
        caseId,
        savedAt: draft.savedAt,
      });
      applyFormSnapshot({
        verificationStatus: draft.verificationStatus || '',
        utvReason: draft.utvReason || '',
        utvRemarks: draft.utvRemarks || '',
        insufficientReason: draft.insufficientReason || '',
        insufficientRemarks: draft.insufficientRemarks || '',
        residenceType: draft.residenceType || DEFAULT_RESIDENCE_TYPE,
        addressType: draft.addressType || DEFAULT_ADDRESS_TYPE,
        respondentName: draft.respondentName || '',
        respondentRelation: draft.respondentRelation || '',
        isSignatureCaptured: draft.isSignatureCaptured || false,
        selectedPhotoTag: draft.selectedPhotoTag || '',
      }, buildCapturedPhotoKey(draft.capturedPhotos ?? []));
      // The screen owns the navigation params the photos live in, so it puts
      // them back; nothing to hand over when the draft has none.
      setDraftPhotosToRestore(
        (draft.capturedPhotos ?? []).length > 0 ? draft.capturedPhotos : null,
      );
      setHasDraft(true);
      setDraftSavedAt(draft.savedAt || null);
    } else {
      LoggerService.info(`${FILE_NAME}: useCaseDetails: no draft found`, { caseId });
      setHasDraft(false);
      setDraftSavedAt(null);
      setDraftPhotosToRestore(null);
    }
  }, [applyFormSnapshot, caseId, caseDetail]);

  const isReadOnly = useMemo(() => {
    if (!caseDetail) {
      LoggerService.info(`${FILE_NAME}: isReadOnly: no case detail yet — treated as editable`);
      return false;
    }
    const value = isReadOnlyCaseBucket(caseDetail.bucket);
    LoggerService.info(`${FILE_NAME}: isReadOnly: resolved`, { bucket: caseDetail.bucket, value });
    return value;
  }, [caseDetail]);

  const isNewCaseValue = useMemo(() => {
    if (!caseDetail) {
      LoggerService.info(`${FILE_NAME}: isNewCase: no case detail yet — treated as not new`);
      return false;
    }
    const value = isNewCaseBucket(caseDetail.bucket);
    LoggerService.info(`${FILE_NAME}: isNewCase: resolved`, { bucket: caseDetail.bucket, value });
    return value;
  }, [caseDetail]);

  const shouldShowDetailFormSectionsValue = useMemo(() => {
    if (!caseDetail) {
      LoggerService.info(
        `${FILE_NAME}: shouldShowDetailFormSections: no case detail yet — sections hidden`,
      );
      return false;
    }
    const value = shouldShowDetailFormSections(caseDetail.bucket);
    LoggerService.info(`${FILE_NAME}: shouldShowDetailFormSections: resolved`, {
      bucket: caseDetail.bucket,
      value,
    });
    return value;
  }, [caseDetail]);

  const currentFormSnapshot = useMemo<CaseFormSnapshot>(
    () => ({
      verificationStatus,
      utvReason,
      utvRemarks,
      insufficientReason,
      insufficientRemarks,
      residenceType,
      addressType,
      respondentName,
      respondentRelation,
      isSignatureCaptured,
      selectedPhotoTag,
    }),
    [
      addressType,
      insufficientReason,
      insufficientRemarks,
      isSignatureCaptured,
      residenceType,
      respondentName,
      respondentRelation,
      selectedPhotoTag,
      utvReason,
      utvRemarks,
      verificationStatus,
    ],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (isReadOnly || isNewCaseValue) {
      LoggerService.info(
        `${FILE_NAME}: hasUnsavedChanges: case is not editable — no unsaved changes`,
        { caseId, isReadOnly, isNewCase: isNewCaseValue },
      );
      return false;
    }
    if (baselineSnapshot === null) {
      LoggerService.info(`${FILE_NAME}: hasUnsavedChanges: no baseline yet — nothing entered`, {
        caseId,
      });
      return false;
    }
    const hasFormChanges = !areFormSnapshotsEqual(currentFormSnapshot, baselineSnapshot);
    const hasPhotoChanges = capturedPhotoKey !== baselinePhotoKey;
    const value = hasFormChanges || hasPhotoChanges;
    LoggerService.info(`${FILE_NAME}: hasUnsavedChanges: resolved`, {
      caseId,
      hasFormChanges,
      hasPhotoChanges,
      value,
    });
    return value;
  }, [
    baselinePhotoKey,
    baselineSnapshot,
    capturedPhotoKey,
    caseId,
    currentFormSnapshot,
    isNewCaseValue,
    isReadOnly,
  ]);

  LoggerService.info(`${FILE_NAME}: useCaseDetails: invoking geo-fence check`, {
    caseId,
    hasCaseDetail: caseDetail !== null,
    hasCaseCoordinates: caseDetail?.coordinates != null,
    caseBucket: caseDetail?.bucket ?? null,
  });

  const geoFence = useCaseGeoFence({
    caseId,
    address: caseDetail?.address ?? '',
    targetCoordinates: caseDetail?.coordinates ?? null,
    isEnabled: caseDetail?.bucket === 'pending',
  });

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
          LoggerService.info(`${FILE_NAME}: acceptCase: request settled`, { caseId });
          setIsSubmitting(false);
        });
    },
    [caseId],
  );

  const isUtvSectionVisible = verificationStatus === VERIFICATION_STATUS_UTV;
  const isInsufficientSectionVisible = verificationStatus === VERIFICATION_STATUS_INSUFFICIENT;
  /*
   * Gated on the live, on-device geo-fence result. A case carries at most
   * coordinates or an address — never a pre-computed in-range verdict — so
   * this is the only thing that knows where the field executive is standing.
   */
  const isVerifiedResidenceSectionVisible =
    verificationStatus === VERIFICATION_STATUS_VERIFIED_CLEAR && geoFence.isCaseContentUnlocked;

  LoggerService.info(`${FILE_NAME}: useCaseDetails: outcome section visibility resolved`, {
    caseId,
    verificationStatus,
    isUtvSectionVisible,
    isInsufficientSectionVisible,
    isVerifiedResidenceSectionVisible,
    geoFenceStatus: geoFence.status,
    isCaseContentUnlocked: geoFence.isCaseContentUnlocked,
  });

  const submit = useCallback(
    (onSubmitted: () => void): void => {
      if (isReadOnly) {
        LoggerService.warn(`${FILE_NAME}: submit: refused — case is read-only`, { caseId });
        return;
      }
      LoggerService.info(`${FILE_NAME}: submit: submitting verification outcome`, { caseId, verificationStatus });
      setIsSubmitting(true);
      setSubmitError(null);

      // Non-reactive read: the fix as of this tap. Normal app usage is only
      // permitted while location is `ready`, so one exists here.
      const currentLocation = useLocationStore.getState().location;
      if (!currentLocation) {
        LoggerService.warn(
          `${FILE_NAME}: submit: no device location fix at submission time — submitting without location evidence`,
          { caseId },
        );
      } else {
        LoggerService.info(`${FILE_NAME}: submit: attaching device location evidence`, {
          caseId,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          isMockLocation: currentLocation.isMockLocation,
        });
      }

      if (geoFence.bypassConsent !== null) {
        LoggerService.warn(`${FILE_NAME}: submit: submitting with force-proceed bypass consent`, {
          caseId,
          distanceMeters: geoFence.distanceMeters,
        });
      }

      LoggerService.info(`${FILE_NAME}: submit: outcome payload assembled`, {
        caseId,
        verificationStatus,
        hasUtvReason: isUtvSectionVisible && utvReason.length > 0,
        utvRemarksLength: isUtvSectionVisible ? utvRemarks.length : 0,
        hasInsufficientReason: isInsufficientSectionVisible && insufficientReason.length > 0,
        insufficientRemarksLength: isInsufficientSectionVisible ? insufficientRemarks.length : 0,
        residenceType: isVerifiedResidenceSectionVisible ? residenceType : null,
        addressType: isVerifiedResidenceSectionVisible ? addressType : null,
        hasRespondentName: isVerifiedResidenceSectionVisible && respondentName.trim().length > 0,
        hasRespondentRelation:
          isVerifiedResidenceSectionVisible && respondentRelation.trim().length > 0,
        isSignatureCaptured,
        distanceMeters: geoFence.distanceMeters,
        forceProceed: geoFence.bypassConsent !== null,
      });

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
        /*
         * The visit's own location evidence. Read at submission time rather
         * than from the earlier measurement, so it reflects where the
         * executive is standing when they submit. `forceProceed` is what marks
         * the case for scrutiny, as the consent dialog promised.
         */
        currentLatitude: currentLocation?.latitude ?? null,
        currentLongitude: currentLocation?.longitude ?? null,
        distanceToCaseMeters: geoFence.distanceMeters,
        forceProceed: geoFence.bypassConsent !== null,
      })
        .then(() => {
          LoggerService.info(`${FILE_NAME}: submit: outcome submitted`, { caseId });
          DraftStorageService.deleteDraft(caseId);
          setBaselineSnapshot(currentFormSnapshot);
          setBaselinePhotoKey(capturedPhotoKey);
          LoggerService.info(`${FILE_NAME}: submit: draft cleared after successful submission`, {
            caseId,
          });
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
          LoggerService.info(`${FILE_NAME}: submit: request settled`, { caseId });
          setIsSubmitting(false);
        });
    },
    [
      addressType,
      capturedPhotoKey,
      caseId,
      currentFormSnapshot,
      geoFence.bypassConsent,
      geoFence.distanceMeters,
      insufficientReason,
      insufficientRemarks,
      isInsufficientSectionVisible,
      isReadOnly,
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

  const saveDraft = useCallback((): void => {
    if (!caseDetail) {
      LoggerService.warn(`${FILE_NAME}: saveDraft: no case detail — cannot save draft`, { caseId });
      return;
    }
    if (isReadOnly) {
      LoggerService.warn(`${FILE_NAME}: saveDraft: refused — case is read-only`, { caseId });
      return;
    }
    LoggerService.info(`${FILE_NAME}: saveDraft: saving draft`, { caseId });
    const savedAt = new Date().toISOString();
    DraftStorageService.saveDraft({
      caseId,
      ...currentFormSnapshot,
      capturedPhotos,
      geoFenceBypassConsent: geoFence.bypassConsent,
      savedAt,
    });
    setHasDraft(true);
    setDraftSavedAt(savedAt);
    // What was just written is the new "saved" state, so the screen stops
    // treating these answers — or these photos — as unsaved.
    setBaselineSnapshot(currentFormSnapshot);
    setBaselinePhotoKey(capturedPhotoKey);
    LoggerService.info(`${FILE_NAME}: saveDraft: draft saved`, {
      caseId,
      savedAt,
      capturedPhotoCount: capturedPhotos.length,
    });
  }, [
    capturedPhotoKey,
    capturedPhotos,
    caseDetail,
    caseId,
    currentFormSnapshot,
    geoFence.bypassConsent,
    isReadOnly,
  ]);

  const clearDraft = useCallback((): void => {
    LoggerService.info(`${FILE_NAME}: clearDraft: clearing draft`, { caseId });
    DraftStorageService.deleteDraft(caseId);
    setHasDraft(false);
    setDraftSavedAt(null);
    setDraftPhotosToRestore(null);
    LoggerService.info(`${FILE_NAME}: clearDraft: draft cleared`, { caseId });
  }, [caseId]);

  /*
   * `setUtvRemarks` / `setInsufficientRemarks` / `setRespondentName` /
   * `setRespondentRelation` are handed to the screen as the raw state setters,
   * so their calls can't be logged individually. This traces the resulting
   * form state instead — lengths and flags only, never the entered text, which
   * is respondent PII.
   */
  LoggerService.info(`${FILE_NAME}: useCaseDetails: form state`, {
    caseId,
    verificationStatus,
    utvReason,
    utvRemarksLength: utvRemarks.length,
    insufficientReason,
    insufficientRemarksLength: insufficientRemarks.length,
    residenceType,
    addressType,
    respondentNameLength: respondentName.length,
    respondentRelationLength: respondentRelation.length,
    isSignatureCaptured,
    selectedPhotoTag,
    isSubmitting,
    hasSubmitError: submitError !== null,
    hasDraft,
    hasUnsavedChanges,
  });

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
    clearDraft,
    draftPhotosToRestore,
    hasUnsavedChanges,
  };
}
