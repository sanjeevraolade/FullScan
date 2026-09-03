import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import { hasUsableGeoCoordinates } from '@/core/utils';
import type { GeoCoordinates } from '@/core/types';
import type {
  AddressType,
  Case,
  CaseBucket,
  CaseDetail,
  CostRequested,
  ResidenceType,
  VerificationOutcomeSubmission,
} from '@/domain/case';

const FILE_NAME = 'case-repository.ts';

const ADDRESS_TYPES: readonly AddressType[] = ['present', 'permanent', 'previous'];
const RESIDENCE_TYPES: readonly ResidenceType[] = [
  'owned',
  'rented',
  'hostel',
  'paying_guest',
  'company_quarters',
  'relative_owned',
];

function mapAddressType(value: string | null): AddressType | null {
  const mapped = ADDRESS_TYPES.find((type) => type === value) ?? null;
  if (mapped === null && value !== null) {
    LoggerService.warn(`${FILE_NAME}: mapAddressType: unrecognised address type — mapped to null`, {
      value,
    });
    return null;
  }
  LoggerService.info(`${FILE_NAME}: mapAddressType: mapped address type`, { value, mapped });
  return mapped;
}

function mapResidenceType(value: string | null): ResidenceType | null {
  const mapped = RESIDENCE_TYPES.find((type) => type === value) ?? null;
  if (mapped === null && value !== null) {
    LoggerService.warn(
      `${FILE_NAME}: mapResidenceType: unrecognised residence type — mapped to null`,
      { value },
    );
    return null;
  }
  LoggerService.info(`${FILE_NAME}: mapResidenceType: mapped residence type`, { value, mapped });
  return mapped;
}

type CaseBucketDto = 'new' | 'pending' | 'beyond_tat' | 'completed';

interface CaseDto {
  readonly id: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly address: string;
  readonly bucket: CaseBucketDto;
  readonly updatedAt: string;
}

/**
 * The assignment's coordinates, however this backend version happens to
 * express them.
 *
 * Both shapes are accepted on purpose: the current API nests them under
 * `gpsCheck` (alongside a pre-computed distance/in-range verdict the app
 * deliberately ignores — only the device can know where the executive is), and
 * the agreed contract is a flat `latitude`/`longitude`. Reading either here
 * means the app works before and after that server change, and nothing above
 * this repository sees the difference.
 */
interface LegacyGpsCheckDto {
  readonly targetLatitude?: number | null;
  readonly targetLongitude?: number | null;
}

interface RespondentDto {
  readonly name: string;
  readonly relation: string;
}

interface CostRequestedDto {
  readonly currency: string;
  readonly amount: number;
}

interface SiblingComponentDto {
  readonly id: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly componentStatus: string;
  readonly bucket: CaseBucketDto;
}

interface CaseDetailDto {
  readonly id: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly bucket: CaseBucketDto;
  readonly tatDueAt: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly verificationType: string;
  readonly clientName: string;
  readonly address: string;
  readonly addressType: string | null;
  readonly residenceType: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly gpsCheck?: LegacyGpsCheckDto | null;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
  readonly selectedVerificationStatus: string | null;
  readonly respondent: RespondentDto | null;
  readonly componentStatus: string;
  readonly actionStatus: string | null;
  readonly profileStatus: string;
  readonly costRequested: CostRequestedDto | null;
  readonly insuffRaisedAt: string | null;
  readonly insuffClearedAt: string | null;
  readonly addlDocRequestedAt: string | null;
  readonly addlDocClearedAt: string | null;
  readonly costApprovalRequestedAt: string | null;
  readonly costApprovedAt: string | null;
  readonly costRejectedAt: string | null;
  readonly siblingComponents: readonly SiblingComponentDto[];
}

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

const BUCKET_DTO_TO_DOMAIN: Record<CaseBucketDto, CaseBucket> = {
  new: 'new',
  pending: 'pending',
  beyond_tat: 'beyondTat',
  completed: 'completed',
};

function mapCase(dto: CaseDto): Case {
  // Candidate/client names are PII — only the ids and the bucket are logged.
  LoggerService.info(`${FILE_NAME}: mapCase: mapping case summary`, {
    caseId: dto.id,
    bucket: BUCKET_DTO_TO_DOMAIN[dto.bucket],
    verificationType: dto.verificationType,
    addressLength: dto.address.length,
  });
  return {
    id: dto.id,
    caseId: dto.caseId,
    caseRef: dto.caseRef,
    clientName: dto.clientName,
    candidateName: dto.candidateName,
    verificationType: dto.verificationType,
    address: dto.address,
    bucket: BUCKET_DTO_TO_DOMAIN[dto.bucket],
    updatedAt: new Date(dto.updatedAt),
  };
}

/**
 * A case's coordinates, or `null` when the back office only has an address —
 * both are normal and callers handle each on its own terms.
 *
 * `0,0` is this column's default value rather than a real point, so
 * `hasUsableGeoCoordinates` rejects it: the alternative is geo-fencing an
 * un-digitized case against the Gulf of Guinea.
 */
function mapCaseCoordinates(dto: CaseDetailDto): GeoCoordinates | null {
  const latitude = dto.latitude ?? dto.gpsCheck?.targetLatitude ?? null;
  const longitude = dto.longitude ?? dto.gpsCheck?.targetLongitude ?? null;

  LoggerService.info(`${FILE_NAME}: mapCaseCoordinates: reading case coordinates`, {
    caseId: dto.id,
    hasFlatLatitude: dto.latitude != null,
    hasFlatLongitude: dto.longitude != null,
    hasLegacyGpsCheck: dto.gpsCheck != null,
    latitude,
    longitude,
  });

  if (latitude === null || longitude === null) {
    // Half-populated is as unusable as absent: a lone axis can't be geo-fenced.
    LoggerService.warn(
      `${FILE_NAME}: mapCaseCoordinates: coordinate pair incomplete — rejected`,
      {
        caseId: dto.id,
        hasLatitude: latitude !== null,
        hasLongitude: longitude !== null,
      },
    );
    return null;
  }

  const coordinates = { latitude, longitude };
  if (!hasUsableGeoCoordinates(coordinates)) {
    // The 0,0 "not geocoded yet" sentinel, or a value outside the valid
    // lat/long ranges — either way the address is the only usable source.
    LoggerService.warn(`${FILE_NAME}: mapCaseCoordinates: coordinates rejected as unusable`, {
      caseId: dto.id,
      latitude,
      longitude,
      isUnsetSentinel: latitude === 0 && longitude === 0,
    });
    LoggerService.info(`${FILE_NAME}: mapCaseCoordinates: case has no usable coordinates`, {
      caseId: dto.id,
    });
    return null;
  }
  LoggerService.info(`${FILE_NAME}: mapCaseCoordinates: coordinates accepted`, {
    caseId: dto.id,
    latitude,
    longitude,
  });
  return coordinates;
}

function mapCostRequested(dto: CostRequestedDto | null): CostRequested | null {
  if (!dto) {
    LoggerService.info(`${FILE_NAME}: mapCostRequested: no cost requested`);
    return null;
  }
  LoggerService.info(`${FILE_NAME}: mapCostRequested: mapped cost request`, {
    currency: dto.currency,
    amount: dto.amount,
  });
  return { currency: dto.currency, amount: dto.amount };
}

function mapNullableDate(value: string | null): Date | null {
  if (!value) {
    LoggerService.info(`${FILE_NAME}: mapNullableDate: no date value`);
    return null;
  }
  const mapped = new Date(value);
  if (Number.isNaN(mapped.getTime())) {
    LoggerService.warn(`${FILE_NAME}: mapNullableDate: unparseable date value`);
    return mapped;
  }
  LoggerService.info(`${FILE_NAME}: mapNullableDate: mapped date value`);
  return mapped;
}

function mapCaseDetail(dto: CaseDetailDto): CaseDetail {
  // Candidate name, father/spouse name, masked phones and the full address are
  // all PII — logged as presence/length only.
  LoggerService.info(`${FILE_NAME}: mapCaseDetail: mapping case detail`, {
    caseId: dto.id,
    bucket: BUCKET_DTO_TO_DOMAIN[dto.bucket],
    verificationType: dto.verificationType,
    componentStatus: dto.componentStatus,
    actionStatus: dto.actionStatus,
    profileStatus: dto.profileStatus,
    selectedVerificationStatus: dto.selectedVerificationStatus,
    hasRespondent: dto.respondent !== null,
    hasCostRequested: dto.costRequested !== null,
    addressLength: dto.address.length,
    clientInstructionsLength: dto.clientInstructions.length,
    fieldExecutiveNotesLength: dto.fieldExecutiveNotes.length,
    siblingComponentCount: dto.siblingComponents.length,
  });
  return {
    id: dto.id,
    caseId: dto.caseId,
    caseRef: dto.caseRef,
    bucket: BUCKET_DTO_TO_DOMAIN[dto.bucket],
    tatDueAt: new Date(dto.tatDueAt),
    candidateName: dto.candidateName,
    fatherOrSpouseName: dto.fatherOrSpouseName,
    employerName: dto.employerName,
    verificationType: dto.verificationType,
    clientName: dto.clientName,
    address: dto.address,
    addressType: mapAddressType(dto.addressType),
    residenceType: mapResidenceType(dto.residenceType),
    coordinates: mapCaseCoordinates(dto),
    maskedPrimaryPhone: dto.maskedPrimaryPhone,
    maskedSecondaryPhone: dto.maskedSecondaryPhone,
    clientInstructions: dto.clientInstructions,
    fieldExecutiveNotes: dto.fieldExecutiveNotes,
    selectedVerificationStatus: dto.selectedVerificationStatus,
    respondent: dto.respondent,
    componentStatus: dto.componentStatus,
    actionStatus: dto.actionStatus,
    profileStatus: dto.profileStatus,
    costRequested: mapCostRequested(dto.costRequested),
    insuffRaisedAt: mapNullableDate(dto.insuffRaisedAt),
    insuffClearedAt: mapNullableDate(dto.insuffClearedAt),
    addlDocRequestedAt: mapNullableDate(dto.addlDocRequestedAt),
    addlDocClearedAt: mapNullableDate(dto.addlDocClearedAt),
    costApprovalRequestedAt: mapNullableDate(dto.costApprovalRequestedAt),
    costApprovedAt: mapNullableDate(dto.costApprovedAt),
    costRejectedAt: mapNullableDate(dto.costRejectedAt),
    siblingComponents: dto.siblingComponents.map((sibling) => {
      LoggerService.info(`${FILE_NAME}: mapCaseDetail: mapping sibling component`, {
        caseId: dto.id,
        siblingId: sibling.id,
        verificationType: sibling.verificationType,
        componentStatus: sibling.componentStatus,
        bucket: BUCKET_DTO_TO_DOMAIN[sibling.bucket],
      });
      return {
        id: sibling.id,
        verificationType: sibling.verificationType,
        addressType: mapAddressType(sibling.addressType),
        componentStatus: sibling.componentStatus,
        bucket: BUCKET_DTO_TO_DOMAIN[sibling.bucket],
      };
    }),
  };
}

/** All case components assigned to the current field executive, across every bucket. */
export async function fetchCases(): Promise<Case[]> {
  LoggerService.info(`${FILE_NAME}: fetchCases: requesting case list`);
  const response = await apiClient.get<ApiEnvelope<CaseDto[]>>('/cases');
  LoggerService.info(`${FILE_NAME}: fetchCases: response received`, {
    success: response.data.success,
    dtoCount: response.data.data.length,
  });
  const cases = response.data.data.map(mapCase);
  LoggerService.info(`${FILE_NAME}: fetchCases: received cases`, { count: cases.length });
  return cases;
}

/** Moves a case component from the New bucket to Pending/In Progress. */
export async function acceptCase(caseId: string): Promise<Case> {
  LoggerService.info(`${FILE_NAME}: acceptCase: accepting case`, { caseId });
  const response = await apiClient.patch<ApiEnvelope<CaseDto>>(`/cases/${caseId}/accept`);
  LoggerService.info(`${FILE_NAME}: acceptCase: response received`, {
    caseId,
    success: response.data.success,
  });
  const updated = mapCase(response.data.data);
  LoggerService.info(`${FILE_NAME}: acceptCase: case accepted`, { caseId, bucket: updated.bucket });
  return updated;
}

/** Full Case Details payload for the verification workflow screen. */
export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  LoggerService.info(`${FILE_NAME}: fetchCaseDetail: requesting case detail`, { caseId });
  const response = await apiClient.get<ApiEnvelope<CaseDetailDto>>(`/cases/${caseId}`);
  LoggerService.info(`${FILE_NAME}: fetchCaseDetail: response received`, {
    caseId,
    success: response.data.success,
  });
  const detail = mapCaseDetail(response.data.data);
  LoggerService.info(`${FILE_NAME}: fetchCaseDetail: received case detail`, { caseId });
  LoggerService.info(`${FILE_NAME}: fetchCaseDetail: domain model ready`, {
    caseId,
    bucket: detail.bucket,
    hasCoordinates: detail.coordinates !== null,
  });
  return detail;
}

/** Submits the field executive's verification outcome for a case component. */
export async function submitVerificationOutcome(
  caseId: string,
  outcome: VerificationOutcomeSubmission,
): Promise<Case> {
  LoggerService.info(`${FILE_NAME}: submitVerificationOutcome: submitting outcome`, {
    caseId,
    verificationStatus: outcome.verificationStatus,
  });
  // Respondent name/relation and remarks are PII — only the payload shape is logged.
  LoggerService.info(`${FILE_NAME}: submitVerificationOutcome: payload shape`, {
    caseId,
    hasUtvReason: outcome.utvReason !== null,
    hasInsufficientReason: outcome.insufficientReason !== null,
    residenceType: outcome.residenceType,
    addressType: outcome.addressType,
    hasRespondent: outcome.respondent !== null,
    isSignatureCaptured: outcome.isSignatureCaptured,
    hasCurrentLocation: outcome.currentLatitude !== null && outcome.currentLongitude !== null,
    distanceToCaseMeters: outcome.distanceToCaseMeters,
    forceProceed: outcome.forceProceed,
  });
  const response = await apiClient.post<ApiEnvelope<CaseDto>>(`/cases/${caseId}/verification-outcome`, outcome);
  LoggerService.info(`${FILE_NAME}: submitVerificationOutcome: response received`, {
    caseId,
    success: response.data.success,
  });
  const updated = mapCase(response.data.data);
  LoggerService.info(`${FILE_NAME}: submitVerificationOutcome: outcome submitted`, { caseId, bucket: updated.bucket });
  return updated;
}
