import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
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
  return ADDRESS_TYPES.find((type) => type === value) ?? null;
}

function mapResidenceType(value: string | null): ResidenceType | null {
  return RESIDENCE_TYPES.find((type) => type === value) ?? null;
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

interface GpsCheckDto {
  readonly targetLatitude: number;
  readonly targetLongitude: number;
  readonly distanceMeters: number;
  readonly isWithinRange: boolean;
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
  readonly gpsCheck: GpsCheckDto;
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

function mapCostRequested(dto: CostRequestedDto | null): CostRequested | null {
  return dto ? { currency: dto.currency, amount: dto.amount } : null;
}

function mapNullableDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function mapCaseDetail(dto: CaseDetailDto): CaseDetail {
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
    gpsCheck: dto.gpsCheck,
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
    siblingComponents: dto.siblingComponents.map((sibling) => ({
      id: sibling.id,
      verificationType: sibling.verificationType,
      addressType: mapAddressType(sibling.addressType),
      componentStatus: sibling.componentStatus,
      bucket: BUCKET_DTO_TO_DOMAIN[sibling.bucket],
    })),
  };
}

/** All case components assigned to the current field executive, across every bucket. */
export async function fetchCases(): Promise<Case[]> {
  LoggerService.info(`${FILE_NAME}: fetchCases: requesting case list`);
  const response = await apiClient.get<ApiEnvelope<CaseDto[]>>('/cases');
  const cases = response.data.data.map(mapCase);
  LoggerService.info(`${FILE_NAME}: fetchCases: received cases`, { count: cases.length });
  return cases;
}

/** Moves a case component from the New bucket to Pending/In Progress. */
export async function acceptCase(caseId: string): Promise<Case> {
  LoggerService.info(`${FILE_NAME}: acceptCase: accepting case`, { caseId });
  const response = await apiClient.patch<ApiEnvelope<CaseDto>>(`/cases/${caseId}/accept`);
  const updated = mapCase(response.data.data);
  LoggerService.info(`${FILE_NAME}: acceptCase: case accepted`, { caseId, bucket: updated.bucket });
  return updated;
}

/** Full Case Details payload for the verification workflow screen. */
export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  LoggerService.info(`${FILE_NAME}: fetchCaseDetail: requesting case detail`, { caseId });
  const response = await apiClient.get<ApiEnvelope<CaseDetailDto>>(`/cases/${caseId}`);
  const detail = mapCaseDetail(response.data.data);
  LoggerService.info(`${FILE_NAME}: fetchCaseDetail: received case detail`, { caseId });
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
  const response = await apiClient.post<ApiEnvelope<CaseDto>>(`/cases/${caseId}/verification-outcome`, outcome);
  const updated = mapCase(response.data.data);
  LoggerService.info(`${FILE_NAME}: submitVerificationOutcome: outcome submitted`, { caseId, bucket: updated.bucket });
  return updated;
}
