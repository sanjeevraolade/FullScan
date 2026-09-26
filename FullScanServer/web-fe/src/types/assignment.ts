/**
 * An "assignment" is one case component held by the signed-in field executive —
 * the unit of work the server's `/api/v1/fe-web/cases` endpoints return.
 */
export type AssignmentBucket = 'pending' | 'beyond_tat' | 'completed';

export const ASSIGNMENT_BUCKETS: readonly AssignmentBucket[] = ['pending', 'beyond_tat', 'completed'];

export interface AssignmentSummary {
  readonly componentId: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly address: string;
  readonly componentStatus: string;
  readonly componentStatusLabel: string;
  /** Wall-clock `YYYY-MM-DD HH:MM:SS`. */
  readonly tatDueAt: string;
  readonly updatedAt: string;
}

/** A summary tagged with the bucket it was listed under. */
export interface Assignment extends AssignmentSummary {
  readonly bucket: AssignmentBucket;
}

export interface AssignmentGroup {
  readonly bucket: AssignmentBucket;
  readonly caseCount: number;
  readonly cases: readonly AssignmentSummary[];
}

export interface AssignmentList {
  readonly caseGroups: readonly AssignmentGroup[];
}

export interface SiblingComponent {
  readonly componentId: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly componentStatusLabel: string;
  readonly isAssignedToYou: boolean;
}

export interface AssignmentDetail {
  readonly componentId: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly bucket: AssignmentBucket;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly residenceType: string | null;
  readonly address: string;
  readonly location: string;
  readonly componentStatus: string;
  readonly componentStatusLabel: string;
  readonly clientInstructions: string;
  readonly tatDueAt: string;
  readonly updatedAt: string;
  readonly canUploadEvidence: boolean;
  readonly siblingComponents: readonly SiblingComponent[];
}

export type AssignmentBucketFilter = AssignmentBucket | 'all';

export interface AssignmentFilter {
  readonly bucket: AssignmentBucketFilter;
  /** Free text matched against case ref, candidate, client, component and address. */
  readonly query: string;
}
