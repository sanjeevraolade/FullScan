import { apiClient } from '@/infrastructure/networking';
import { LoggerService } from '@/infrastructure/logger';
import type {
  MockLocationDetection,
  MockLocationDetectionReceipt,
} from '@/domain/security';

const FILE_NAME = 'security-repository.ts';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

interface MockLocationReportRequest {
  readonly clientEventId: string;
  readonly detectionStage: string;
  readonly detectedAt: string;
  readonly fix?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMeters: number;
    readonly capturedAt: string;
    readonly source: string;
  };
  readonly caseId?: string;
  readonly device: {
    readonly deviceId: string;
    readonly deviceName: string;
    readonly model: string;
    readonly brand: string;
    readonly manufacturer: string;
    readonly deviceType: string;
    readonly systemName: string;
    readonly osVersion: string;
    readonly appVersion: string;
    readonly appBuildNumber: string;
    readonly installerPackageName: string;
    readonly isEmulator: boolean;
    readonly timeZone: string;
  };
}

interface MockLocationReportResponseDto {
  readonly eventId: string;
  readonly isDuplicate: boolean;
  readonly reportedAt: string;
  readonly totalEventCount: number;
  readonly firstDetectedAt: string | null;
}

function toRequest(detection: MockLocationDetection): MockLocationReportRequest {
  LoggerService.info(`${FILE_NAME}: toRequest: mapping detection to the wire shape`, {
    detectionStage: detection.detectionStage,
    hasFix: detection.fix !== null,
    hasCaseId: detection.caseId !== null,
  });

  return {
    clientEventId: detection.clientEventId,
    detectionStage: detection.detectionStage,
    detectedAt: detection.detectedAt.toISOString(),
    ...(detection.fix
      ? {
          fix: {
            latitude: detection.fix.latitude,
            longitude: detection.fix.longitude,
            accuracyMeters: detection.fix.accuracyMeters,
            capturedAt: detection.fix.capturedAt.toISOString(),
            source: detection.fix.source,
          },
        }
      : {}),
    ...(detection.caseId ? { caseId: detection.caseId } : {}),
    device: { ...detection.device },
  };
}

/**
 * Reports a detected mock/faked device location to the back office.
 *
 * Rejects with the underlying AxiosError so the caller can tell a transient
 * failure (retry later) from a rejected payload (drop it). The server is
 * idempotent on `clientEventId`, so re-sending the same detection is safe.
 */
export async function reportMockLocationDetection(
  detection: MockLocationDetection,
): Promise<MockLocationDetectionReceipt> {
  LoggerService.warn(`${FILE_NAME}: reportMockLocationDetection: reporting a mock location`, {
    detectionStage: detection.detectionStage,
    isEmulator: detection.device.isEmulator,
  });

  const response = await apiClient.post<ApiEnvelope<MockLocationReportResponseDto>>(
    '/security/mock-location',
    toRequest(detection),
  );

  const { eventId, isDuplicate, reportedAt, totalEventCount, firstDetectedAt } = response.data.data;

  LoggerService.warn(`${FILE_NAME}: reportMockLocationDetection: detection recorded`, {
    success: response.data.success,
    isDuplicate,
    totalDetectionCount: totalEventCount,
  });

  return {
    eventId,
    isDuplicate,
    reportedAt,
    totalDetectionCount: totalEventCount,
    firstDetectedAt,
  };
}
