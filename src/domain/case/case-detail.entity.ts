import type { GeoCoordinates } from '@/core/types';

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
  /**
   * The assignment's coordinates when the back office has them, `null` when it
   * only has `address`.
   *
   * Both states are first-class and permanently supported: a case is located
   * from these coordinates when present and from `address` when not, and
   * neither is a fallback for the other. Today most records are address-only
   * and as digitization progresses more will arrive with coordinates — that
   * shift needs no code change, it simply moves cases from one branch of
   * `useCaseGeoFence`'s resolution step to the other.
   *
   * A case never carries more than coordinates or an address string — no
   * server-computed distance and no in-range verdict — because only the device
   * can know where the field executive actually is at the moment of the visit.
   */
  readonly coordinates: GeoCoordinates | null;
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
  /**
   * Where the field executive was standing when they submitted — the device's
   * own fix, not anything the back office pre-computed. `null` only in the
   * degenerate case where no fix was ever obtained (normal app use requires
   * one, so this should not happen in practice).
   */
  readonly currentLatitude: number | null;
  readonly currentLongitude: number | null;
  /**
   * Measured distance from that position to the case location, in metres, or
   * `null` when the case location could never be determined. Sent as measured;
   * the back office compares it against the configured radius itself rather
   * than trusting an app-side verdict.
   */
  readonly distanceToCaseMeters: number | null;
  /**
   * `true` when the field executive completed this case without satisfying the
   * geo-fence, via the Force Proceed consent flow.
   *
   * The submission itself is an ordinary one — the back office accepts it like
   * any other case and uses this flag to mark it for scrutiny, exactly as the
   * consent dialog warns. The remaining consent detail (configured radius,
   * attempt count, consent timestamp) stays on the device in
   * `useGeoFenceBypassStore` rather than on the wire.
   */
  readonly forceProceed: boolean;
}
