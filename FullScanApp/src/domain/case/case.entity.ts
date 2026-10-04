/**
 * Workflow bucket a case currently sits in (see the product spec's case
 * workflow: New -> Pending/In Progress -> Beyond TAT -> Completed).
 */
export type CaseBucket = 'new' | 'pending' | 'beyondTat' | 'completed';

/** Every bucket, in workflow order. */
export const CASE_BUCKETS: readonly CaseBucket[] = ['new', 'pending', 'beyondTat', 'completed'];

/** How many case components sit in each bucket, as the case-list tab badges show them. */
export type CaseBucketCounts = Record<CaseBucket, number>;

/**
 * A single verification component (e.g. present address, permanent address,
 * employment) — the field executive's actual unit of work, as the case list
 * shows it. A case (`caseRef`) routinely has several of these, each
 * progressing independently; see `CaseDetail.siblingComponents` for the rest
 * of a given case's components.
 *
 * Carries no bucket: a summary belongs to whichever case-list tab it was
 * requested for.
 */
export interface Case {
  readonly id: string;
  /** The component ("check") id — the same value as `id`. */
  readonly checkId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly address: string;
  readonly updatedAt: Date;
}
