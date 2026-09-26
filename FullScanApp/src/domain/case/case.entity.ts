/**
 * Workflow bucket a case currently sits in (see the product spec's case
 * workflow: New -> Pending/In Progress -> Beyond TAT -> Completed).
 */
export type CaseBucket = 'new' | 'pending' | 'beyondTat' | 'completed';

/**
 * A single verification component (e.g. present address, permanent address,
 * employment) — the field executive's actual unit of work. A case (`caseId`/
 * `caseRef`) routinely has several of these, each progressing independently;
 * see `CaseDetail.siblingComponents` for the rest of a given case's
 * components.
 */
export interface Case {
  readonly id: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly address: string;
  readonly bucket: CaseBucket;
  readonly updatedAt: Date;
}
