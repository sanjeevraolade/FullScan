/**
 * Workflow bucket a case currently sits in (see the product spec's case
 * workflow: New -> Pending/In Progress -> Beyond TAT -> Completed).
 */
export type CaseBucket = 'new' | 'pending' | 'beyondTat' | 'completed';

export interface Case {
  readonly id: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly address: string;
  readonly bucket: CaseBucket;
  readonly updatedAt: Date;
}
