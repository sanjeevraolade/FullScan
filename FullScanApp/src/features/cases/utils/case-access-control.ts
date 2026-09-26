import { LoggerService } from '@/infrastructure/logger';
import type { CaseBucket } from '@/domain/case';

const FILE_NAME = 'case-access-control.ts';

/**
 * Determine if a case is in read-only mode based on its bucket.
 * Only completed cases are read-only; new cases show limited information with Accept button.
 * - new: Limited info (case details + location only), with Accept button
 * - pending: Editable
 * - beyondTat: Editable
 * - completed: Read-only
 */
export function isReadOnlyCaseBucket(bucket: CaseBucket): boolean {
  const isReadOnly = bucket === 'completed';
  LoggerService.info(`${FILE_NAME}: isReadOnlyCaseBucket: evaluated bucket`, { bucket, isReadOnly });
  return isReadOnly;
}

/**
 * Determine if a case is a new case (awaiting acceptance).
 */
export function isNewCaseBucket(bucket: CaseBucket): boolean {
  const isNewCase = bucket === 'new';
  LoggerService.info(`${FILE_NAME}: isNewCaseBucket: evaluated bucket`, { bucket, isNewCase });
  return isNewCase;
}

/**
 * Determine if detail form sections should be shown (verification outcome, residence, photos).
 * New cases only show case info and location.
 */
export function shouldShowDetailFormSections(bucket: CaseBucket): boolean {
  const shouldShow = bucket !== 'new';
  LoggerService.info(`${FILE_NAME}: shouldShowDetailFormSections: evaluated bucket`, {
    bucket,
    shouldShow,
  });
  return shouldShow;
}

/**
 * Get a user-facing message explaining why a case is read-only.
 */
export function getReadOnlyReasonKey(bucket: CaseBucket): string | null {
  LoggerService.info(`${FILE_NAME}: getReadOnlyReasonKey: resolving reason key`, { bucket });
  switch (bucket) {
    case 'new':
      LoggerService.info(`${FILE_NAME}: getReadOnlyReasonKey: new case — limited information`, {
        bucket,
      });
      return 'caseDetails.readOnly.newCase';
    case 'completed':
      LoggerService.info(`${FILE_NAME}: getReadOnlyReasonKey: completed case — read-only`, {
        bucket,
      });
      return 'caseDetails.readOnly.completedCase';
    default:
      LoggerService.info(`${FILE_NAME}: getReadOnlyReasonKey: editable bucket — no reason key`, {
        bucket,
      });
      return null;
  }
}
