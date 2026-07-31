import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import type { Case, CaseBucket } from '@/domain/case';

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
