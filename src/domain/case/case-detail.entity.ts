import type { CaseBucket } from './case.entity';

/** How the candidate answered the door, independent of who owns the property. */
export type ResidenceType = 'owned' | 'rented' | 'hostel' | 'paying_guest' | 'company_quarters' | 'relative_owned';

/** Whether the visited address is the candidate's current, permanent, or a previous address. */
export type AddressType = 'present' | 'permanent' | 'previous';

/**
 * Verification-status *codes* — stable identifiers the app compares
 * against to decide which form sections to show. These are business rules,
 * not display copy: the matching label (what the field executive actually
 * sees) comes from `ReferenceData.verificationTypeStatuses` at runtime, so
 * the backend can reword it without an app release.
 */
export const VERIFICATION_STATUS_VERIFIED_CLEAR = 'verified_clear';
export const VERIFICATION_STATUS_UTV = 'utv';
export const VERIFICATION_STATUS_INSUFFICIENT = 'insufficient';

export interface Respondent {
  readonly name: string;
  readonly relation: string;
}

/**
 * Result of comparing the visited location against the assignment's target
 * address. `isWithinRange` and `distanceMeters` are computed server-side so
 * the app never hardcodes a match-distance threshold.
 */
export interface GpsCheck {
  readonly targetLatitude: number;
  readonly targetLongitude: number;
  readonly distanceMeters: number;
  readonly isWithinRange: boolean;
}

/** How much the client is being charged for this component's extra visit/effort, if anything was requested. */
export interface CostRequested {
  readonly currency: string;
  readonly amount: number;
}

/**
 * A sibling component of the same case (see `Case`/`CaseDetail.caseId`) —
 * just enough to show case-wide context (e.g. "Present Address ✓,
 * Permanent Address (this one)") without a second network round trip.
 */
export interface SiblingComponent {
  readonly id: string;
  readonly verificationType: string;
  readonly addressType: AddressType | null;
  /** A `ReferenceData.componentStatuses` code. */
  readonly componentStatus: string;
  readonly bucket: CaseBucket;
}

/**
 * Full Case Details payload — everything the verification workflow screen
 * needs beyond the case-list summary (`Case`). Fetched by id (a component
 * id) when a field executive opens a case; `siblingComponents` carries the
 * rest of that component's parent case for context.
 */
export interface CaseDetail {
  readonly id: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly bucket: CaseBucket;
  readonly tatDueAt: Date;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly verificationType: string;
  readonly clientName: string;
  readonly address: string;
  readonly addressType: AddressType | null;
  readonly residenceType: ResidenceType | null;
  readonly gpsCheck: GpsCheck;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
  /** A `ReferenceData.verificationTypeStatuses` code, or null when no outcome has been recorded yet. */
  readonly selectedVerificationStatus: string | null;
  readonly respondent: Respondent | null;
  /** A `ReferenceData.componentStatuses` code — this component's real-world status. */
  readonly componentStatus: string;
  /** A `ReferenceData.actionStatuses` code, or null while awaiting action. */
  readonly actionStatus: string | null;
  /** A `ReferenceData.profileStatuses` code — the whole case's aggregate report status. */
  readonly profileStatus: string;
  readonly costRequested: CostRequested | null;
  readonly insuffRaisedAt: Date | null;
  readonly insuffClearedAt: Date | null;
  readonly addlDocRequestedAt: Date | null;
  readonly addlDocClearedAt: Date | null;
  readonly costApprovalRequestedAt: Date | null;
  readonly costApprovedAt: Date | null;
  readonly costRejectedAt: Date | null;
  readonly siblingComponents: readonly SiblingComponent[];
}

/** Field executive's verification outcome, submitted once the form is complete. */
export interface VerificationOutcomeSubmission {
  readonly verificationStatus: string;
  readonly utvReason: string | null;
  readonly utvRemarks: string | null;
  readonly insufficientReason: string | null;
  readonly insufficientRemarks: string | null;
  readonly residenceType: ResidenceType | null;
  readonly addressType: AddressType | null;
  readonly respondent: Respondent | null;
  readonly isSignatureCaptured: boolean;
}
