import { LoggerService } from '@/infrastructure/logger';
import { uploadCaseEvidence } from '@/repositories/case-evidence-repository';
import type { CapturedPhotoEvidence } from '@/domain/case';

import { EvidenceReceiptStorageService } from './evidence-receipt-storage';

const FILE_NAME = 'case-evidence-uploader.ts';

export interface EvidenceUploadProgress {
  /** Photos the server already holds — receipted by an earlier attempt or uploaded in this one. */
  readonly uploadedCount: number;
  readonly totalCount: number;
}

/**
 * One entry per file: the same capture listed twice is still one piece of
 * evidence (and one receipt), so it is neither uploaded nor counted twice.
 */
function dedupeByFilePath(
  photos: readonly CapturedPhotoEvidence[],
): readonly CapturedPhotoEvidence[] {
  const seenFilePaths = new Set<string>();
  const uniquePhotos = photos.filter((photo) => {
    if (seenFilePaths.has(photo.filePath)) {
      return false;
    }
    seenFilePaths.add(photo.filePath);
    return true;
  });
  LoggerService.info(`${FILE_NAME}: dedupeByFilePath: de-duplicated captured photos`, {
    count: photos.length,
    uniqueCount: uniquePhotos.length,
  });
  return uniquePhotos;
}

/**
 * Uploads every captured photo of a case that has no upload receipt yet,
 * one request at a time in capture order (the order the camera appended
 * them), recording a receipt after each success so a retry — even after a
 * restart — only sends what is left.
 *
 * Stops at the first failure and rejects with it (a
 * `CaseEvidenceUploadError` from the repository); receipts for the photos
 * before it are kept. Reports progress only when something is actually
 * uploaded — nothing pending means no progress and no requests.
 */
export async function uploadPendingCaseEvidence(
  caseId: string,
  photos: readonly CapturedPhotoEvidence[],
  onProgress: (progress: EvidenceUploadProgress) => void,
): Promise<void> {
  const uniquePhotos = dedupeByFilePath(photos);
  const receipts = EvidenceReceiptStorageService.getReceipts(caseId);
  const pendingPhotos = uniquePhotos.filter((photo) => receipts[photo.filePath] === undefined);
  const totalCount = uniquePhotos.length;
  let uploadedCount = totalCount - pendingPhotos.length;

  LoggerService.info(`${FILE_NAME}: uploadPendingCaseEvidence: evidence to upload resolved`, {
    caseId,
    totalCount,
    alreadyUploadedCount: uploadedCount,
    pendingCount: pendingPhotos.length,
  });
  if (pendingPhotos.length === 0) {
    LoggerService.info(`${FILE_NAME}: uploadPendingCaseEvidence: nothing left to upload`, {
      caseId,
    });
    return;
  }

  onProgress({ uploadedCount, totalCount });
  // Sequential on purpose: one photo at a time keeps a weak field connection
  // usable and makes "stop at the first failure" exact.
  for (const photo of pendingPhotos) {
    LoggerService.info(`${FILE_NAME}: uploadPendingCaseEvidence: uploading next photo`, {
      caseId,
      documentTypeCode: photo.documentTypeCode,
      position: uploadedCount + 1,
      totalCount,
    });
    const evidence = await uploadCaseEvidence(caseId, photo);
    EvidenceReceiptStorageService.markUploaded(caseId, photo.filePath, evidence.id);
    uploadedCount += 1;
    onProgress({ uploadedCount, totalCount });
  }
  LoggerService.info(`${FILE_NAME}: uploadPendingCaseEvidence: every photo uploaded`, {
    caseId,
    totalCount,
  });
}
