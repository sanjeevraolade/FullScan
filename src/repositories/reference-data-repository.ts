import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import type { ReferenceData } from '@/domain/reference-data';

const FILE_NAME = 'reference-data-repository.ts';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

/** Bulk dropdown/option data (statuses, UTV/Insufficient reasons, photo types) fetched once after login. */
export async function fetchReferenceData(): Promise<ReferenceData> {
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: requesting reference data`);
  const response = await apiClient.get<ApiEnvelope<ReferenceData>>('/reference-data');
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: received reference data`);
  return response.data.data;
}
