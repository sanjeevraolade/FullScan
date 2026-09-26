export type CaseBucket = 'new' | 'pending' | 'beyond_tat' | 'completed';

export const CASE_BUCKETS: readonly CaseBucket[] = ['new', 'pending', 'beyond_tat', 'completed'];

export interface DropdownOption {
  readonly code: string;
  readonly label: string;
}

export interface CaseFormOptions {
  readonly buckets: readonly string[];
  readonly addressTypes: readonly string[];
  readonly residenceTypes: readonly string[];
  readonly componentStatuses: readonly DropdownOption[];
  readonly actionStatuses: readonly DropdownOption[];
  readonly profileStatuses: readonly DropdownOption[];
}

/** One component row in the admin case list. */
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

export interface CaseCategoryCount {
  readonly bucket: CaseBucket;
  readonly count: number;
}

export interface AdminCaseListResult {
  readonly items: readonly AdminCaseListItem[];
  readonly total: number;
  readonly categories: readonly CaseCategoryCount[];
  readonly limit: number;
  readonly offset: number;
}

export type CaseBucketFilter = CaseBucket | 'all';

export interface CaseListFilter {
  readonly bucket: CaseBucketFilter;
  readonly search: string;
  readonly fieldExecutiveId: string;
  readonly offset: number;
}

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

/** Component fields sent on create/update. `id` present = update that component. */
export interface CaseComponentPayload {
  readonly id?: string;
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
  readonly assignedToName: string;
  readonly tatDueAt: string;
  readonly targetLatitude: number;
  readonly targetLongitude: number;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
}

export interface CasePayload {
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly primaryContactNumber: string;
  readonly secondaryContactNumber: string;
  readonly profileStatus: string;
  readonly components: readonly CaseComponentPayload[];
}

/** Web-uploaded evidence as the back office sees it. */
export interface AdminCaseEvidence {
  readonly id: string;
  readonly componentId: string;
  readonly source: 'web_upload';
  readonly fileName: string;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly uploadedAt: string;
  readonly uploadedBy: { readonly id: string; readonly name: string; readonly username: string };
}

export interface AdminCaseEvidenceList {
  readonly caseId: string;
  readonly evidence: readonly AdminCaseEvidence[];
}
