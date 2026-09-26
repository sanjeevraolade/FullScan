import type { CaseBucket } from './case.types.js';
import type { DropdownOption } from './reference-data.types.js';

/**
 * Admin-facing case types.
 *
 * The back office works with the **whole case** — the candidate/client record
 * plus every verification component under it — whereas the mobile app works
 * with one component at a time. So the list is component-level (a component is
 * what carries a bucket, an assignee and a TAT), while create/update operate on
 * a case and the components beneath it.
 */

/** The four workflow categories a component can sit in — the portal's tabs. */
export const CASE_BUCKETS: readonly CaseBucket[] = ['new', 'pending', 'beyond_tat', 'completed'];

/** Mirrors the CHECK constraints on `case_components` (migration 009). */
export const ADDRESS_TYPES: readonly string[] = ['present', 'permanent', 'previous'];

export const RESIDENCE_TYPES: readonly string[] = [
  'owned',
  'rented',
  'hostel',
  'paying_guest',
  'company_quarters',
  'relative_owned',
];

/** One component row in the admin case list, carrying enough case-level identity to be readable. */
export interface AdminCaseListItem {
  readonly id: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly bucket: CaseBucket;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly address: string;
  readonly componentStatus: string;
  readonly actionStatus: string | null;
  readonly profileStatus: string;
  readonly assignedFieldExecutiveId: string | null;
  readonly assignedFieldExecutiveName: string | null;
  readonly assignedToName: string;
  readonly tatDueAt: string;
  readonly updatedAt: string;
}

/** Component count per workflow category, so the portal can label its tabs. */
export interface CaseCategoryCount {
  readonly bucket: CaseBucket;
  readonly count: number;
}

export interface AdminCaseListFilter {
  readonly bucket?: CaseBucket;
  readonly search?: string;
  readonly fieldExecutiveId?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminCaseListResult {
  readonly items: readonly AdminCaseListItem[];
  /** Components matching the filter *including* the bucket filter. */
  readonly total: number;
  /** Per-category counts ignoring the bucket filter, so every tab shows its own total. */
  readonly categories: readonly CaseCategoryCount[];
  readonly limit: number;
  readonly offset: number;
}

/** A component as the admin editor sees it — every field the back office may change. */
export interface AdminCaseComponent {
  readonly id: string;
  readonly bucket: CaseBucket;
  readonly componentStatus: string;
  readonly actionStatus: string | null;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly residenceType: string | null;
  readonly address: string;
  readonly location: string;
  readonly remarks: string;
  readonly additionalVerificationInstructions: string;
  readonly additionalVerificationRemarks: string;
  readonly assignedFieldExecutiveId: string | null;
  readonly assignedFieldExecutiveName: string | null;
  readonly assignedToName: string;
  readonly tatDueAt: string;
  readonly targetLatitude: number;
  readonly targetLongitude: number;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
  readonly selectedVerificationStatus: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A case plus all of its components — the payload behind the admin detail/edit screen. */
export interface AdminCaseDetail {
  readonly id: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly primaryContactNumber: string;
  readonly secondaryContactNumber: string;
  readonly profileStatus: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly components: readonly AdminCaseComponent[];
}

/** Case-level fields an admin supplies when creating or updating a case. */
export interface AdminCaseInput {
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName?: string;
  readonly employerName?: string;
  readonly primaryContactNumber?: string;
  readonly secondaryContactNumber?: string;
  readonly profileStatus: string;
}

/**
 * Component fields an admin supplies. `id` present means "update this existing
 * component"; absent means "add a new one to the case".
 */
export interface AdminCaseComponentInput {
  readonly id?: string;
  readonly bucket: CaseBucket;
  readonly componentStatus: string;
  readonly actionStatus?: string | null;
  readonly verificationType: string;
  readonly addressType?: string | null;
  readonly residenceType?: string | null;
  readonly address: string;
  readonly location?: string;
  readonly remarks?: string;
  readonly additionalVerificationInstructions?: string;
  readonly additionalVerificationRemarks?: string;
  readonly assignedFieldExecutiveId?: string | null;
  readonly assignedToName?: string;
  readonly tatDueAt?: string;
  readonly targetLatitude?: number;
  readonly targetLongitude?: number;
  readonly maskedPrimaryPhone?: string;
  readonly maskedSecondaryPhone?: string;
  readonly clientInstructions?: string;
  readonly fieldExecutiveNotes?: string;
}

export interface CreateCaseInput extends AdminCaseInput {
  readonly components: readonly AdminCaseComponentInput[];
}

export interface UpdateCaseInput extends AdminCaseInput {
  /** Components to upsert. Components of the case left out of this list are untouched. */
  readonly components: readonly AdminCaseComponentInput[];
}

/** Row shape of `cases` on its own — no component join. */
export interface CaseRow {
  readonly id: string;
  readonly case_ref: string;
  readonly client_name: string;
  readonly candidate_name: string;
  readonly father_or_spouse_name: string;
  readonly employer_name: string;
  readonly primary_contact_number: string;
  readonly secondary_contact_number: string;
  readonly profile_status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/** The vocabularies the admin case editor builds its selects from. */
export interface CaseFormOptions {
  readonly buckets: readonly string[];
  readonly addressTypes: readonly string[];
  readonly residenceTypes: readonly string[];
  readonly componentStatuses: readonly DropdownOption[];
  readonly actionStatuses: readonly DropdownOption[];
  readonly profileStatuses: readonly DropdownOption[];
}
