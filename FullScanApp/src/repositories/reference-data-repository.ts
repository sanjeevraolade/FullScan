import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import type { ReferenceData } from '@/domain/reference-data';

const FILE_NAME = 'reference-data-repository.ts';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

/**
 * Server endpoint for the reference-data payload. The server calls it "master
 * data"; every layer above this repository keeps the `ReferenceData` name, so
 * the rename stops here.
 */
const MASTER_DATA_PATH = '/master-data';

/**
 * Bulk dropdown/option data (statuses, UTV/Insufficient reasons, photo types)
 * plus `mobileAppSettings`, fetched once after login from `GET /master-data`.
 */
export async function fetchReferenceData(): Promise<ReferenceData> {
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: requesting reference data`, {
    path: MASTER_DATA_PATH,
  });
  const response = await apiClient.get<ApiEnvelope<ReferenceData>>(MASTER_DATA_PATH);
  const referenceData = response.data.data;
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: received reference data`);
  LoggerService.info(`${FILE_NAME}: fetchReferenceData: option counts`, {
    success: response.data.success,
    verificationTypeStatusCount: referenceData.verificationTypeStatuses.length,
    utvOptionCount: referenceData.utvOptions.length,
    insuffOptionCount: referenceData.insuffOptions.length,
    photoTypeCount: referenceData.photoTypes.length,
    componentStatusCount: referenceData.componentStatuses.length,
    actionStatusCount: referenceData.actionStatuses.length,
    profileStatusCount: referenceData.profileStatuses.length,
    hasMobileAppSettings: referenceData.mobileAppSettings != null,
  });
  return response.data.data;
}
