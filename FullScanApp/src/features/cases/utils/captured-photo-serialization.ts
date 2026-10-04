import { LoggerService } from '@/infrastructure/logger';
import type { CapturedPhotoEvidence } from '@/domain/case';
import type { SerializedCapturedPhotoEvidence } from '@/navigation/routes';

const FILE_NAME = 'captured-photo-serialization.ts';

/**
 * Rehydrates a photo from its JSON-safe navigation/draft shape. The ISO
 * string always comes from `Date.toISOString()`, so the round trip is exact.
 */
export function toCapturedPhotoEvidence(
  serializedPhoto: SerializedCapturedPhotoEvidence,
): CapturedPhotoEvidence {
  // The file path and coordinates are evidence — only the tag is logged.
  LoggerService.info(`${FILE_NAME}: toCapturedPhotoEvidence: rehydrating captured photo`, {
    documentTypeCode: serializedPhoto.documentTypeCode,
  });
  const { capturedAtIso, ...rest } = serializedPhoto;
  return { ...rest, capturedAt: new Date(capturedAtIso) };
}
