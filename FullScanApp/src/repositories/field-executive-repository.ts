import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import type { FieldExecutive } from '@/domain/field-executive';

const FILE_NAME = 'field-executive-repository.ts';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

/** Profile of the currently logged-in field executive. */
export async function fetchCurrentFieldExecutive(): Promise<FieldExecutive> {
  LoggerService.info(`${FILE_NAME}: fetchCurrentFieldExecutive: requesting profile`);
  const response = await apiClient.get<ApiEnvelope<FieldExecutive>>('/me');
  // Name and email identify a person — only the id and role are logged.
  LoggerService.info(`${FILE_NAME}: fetchCurrentFieldExecutive: response received`, {
    success: response.data.success,
    role: response.data.data.role,
  });
  LoggerService.info(`${FILE_NAME}: fetchCurrentFieldExecutive: received profile`, {
    fieldExecutiveId: response.data.data.id,
  });
  return response.data.data;
}
