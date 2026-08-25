import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import type { Case, CaseBucket, CaseDetail, VerificationOutcomeSubmission } from '@/domain/case';

const FILE_NAME = 'case-repository.ts';

type CaseBucketDto = 'new' | 'pending' | 'beyond_tat' | 'completed';

interface CaseDto {
  readonly id: string;
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

interface CaseDetailDto {
  readonly id: string;
  readonly caseRef: string;
  readonly bucket: CaseBucketDto;
  readonly tatDueAt: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly verificationType: string;
  readonly clientName: string;
  readonly address: string;
  readonly gpsCheck: GpsCheckDto;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
  readonly selectedVerificationStatus: string | null;
  readonly respondent: RespondentDto | null;
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
    caseRef: dto.caseRef,
    clientName: dto.clientName,
    candidateName: dto.candidateName,
    verificationType: dto.verificationType,
    address: dto.address,
    bucket: BUCKET_DTO_TO_DOMAIN[dto.bucket],
    updatedAt: new Date(dto.updatedAt),
  };
}

function mapCaseDetail(dto: CaseDetailDto): CaseDetail {
  return {
    id: dto.id,
    caseRef: dto.caseRef,
    bucket: BUCKET_DTO_TO_DOMAIN[dto.bucket],
    tatDueAt: new Date(dto.tatDueAt),
    candidateName: dto.candidateName,
    fatherOrSpouseName: dto.fatherOrSpouseName,
    employerName: dto.employerName,
    verificationType: dto.verificationType,
    clientName: dto.clientName,
    address: dto.address,
    gpsCheck: dto.gpsCheck,
    maskedPrimaryPhone: dto.maskedPrimaryPhone,
    maskedSecondaryPhone: dto.maskedSecondaryPhone,
    clientInstructions: dto.clientInstructions,
    fieldExecutiveNotes: dto.fieldExecutiveNotes,
    selectedVerificationStatus: dto.selectedVerificationStatus,
    respondent: dto.respondent,
  };
}

/** All cases assigned to the current field executive, across every bucket. */
export async function fetchCases(): Promise<Case[]> {
  LoggerService.info(`${FILE_NAME}: fetchCases: requesting case list`);
  const response = await apiClient.get<ApiEnvelope<CaseDto[]>>('/cases');
  const cases = response.data.data.map(mapCase);
  LoggerService.info(`${FILE_NAME}: fetchCases: received cases`, { count: cases.length });
  return cases;
}

/** Moves a case from the New bucket to Pending/In Progress. */
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

/** Submits the field executive's verification outcome for a case. */
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
