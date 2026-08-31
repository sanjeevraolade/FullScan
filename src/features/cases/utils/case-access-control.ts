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
  return bucket === 'completed';
}

/**
 * Determine if a case is a new case (awaiting acceptance).
 */
export function isNewCaseBucket(bucket: CaseBucket): boolean {
  return bucket === 'new';
}

/**
 * Determine if detail form sections should be shown (verification outcome, residence, photos).
 * New cases only show case info and location.
 */
export function shouldShowDetailFormSections(bucket: CaseBucket): boolean {
  return bucket !== 'new';
}

/**
 * Get a user-facing message explaining why a case is read-only.
 */
export function getReadOnlyReasonKey(bucket: CaseBucket): string | null {
  switch (bucket) {
    case 'new':
      return 'caseDetails.readOnly.newCase';
    case 'completed':
      return 'caseDetails.readOnly.completedCase';
    default:
      return null;
  }
}
