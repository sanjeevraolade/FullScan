import type { CaseBucket } from './case.types.js';

/**
 * Buckets the field executive web portal lists. `new` is excluded: it is the
 * shared pool of unclaimed work (the mobile app re-draws it at random), not cases
 * this executive holds. Claiming a case still happens in the mobile app.
 */
export type FeWebCaseBucket = Exclude<CaseBucket, 'new'>;

/**
 * One case component as the FE sees it on the web — read-only, list-level fields
 * only. Contact numbers, GPS targets and fraud-detection data are deliberately
 * not part of this shape.
 */
export interface FeWebCaseSummary {
  readonly componentId: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly address: string;
  /** dropdown_options(category='component_status').code */
  readonly componentStatus: string;
  /** Label for `componentStatus`, falling back to the code when it has none. */
  readonly componentStatusLabel: string;
  readonly tatDueAt: string;
  readonly updatedAt: string;
}

/** One category's cases, rendered as its own headed list. */
export interface FeWebCaseGroup {
  readonly bucket: FeWebCaseBucket;
  readonly caseCount: number;
  readonly cases: readonly FeWebCaseSummary[];
}

export interface FeWebCaseList {
  /** Always Pending, Beyond TAT, Completed — in that order, even when empty. */
  readonly caseGroups: readonly FeWebCaseGroup[];
}

/** Another component of the same case — enough context to show what else the case covers. */
export interface FeWebSiblingComponent {
  readonly componentId: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly componentStatusLabel: string;
  /** Only components this executive holds can be opened on the web. */
  readonly isAssignedToYou: boolean;
}

/**
 * One case component's details as the FE sees them on the web. Still read-only
 * case data: no contact numbers, GPS targets, respondent or fraud-detection fields.
 */
export interface FeWebCaseDetail {
  readonly componentId: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly bucket: FeWebCaseBucket;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly residenceType: string | null;
  readonly address: string;
  /** Locality line, e.g. "Chanda Nagar, Hyderabad, Telangana". */
  readonly location: string;
  readonly componentStatus: string;
  readonly componentStatusLabel: string;
  readonly clientInstructions: string;
  readonly tatDueAt: string;
  readonly updatedAt: string;
  /** Evidence can be added while the component is Pending or Beyond TAT, never once Completed. */
  readonly canUploadEvidence: boolean;
  readonly siblingComponents: readonly FeWebSiblingComponent[];
}
