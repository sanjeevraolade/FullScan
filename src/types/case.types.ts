export type CaseBucket = 'new' | 'pending' | 'beyond_tat' | 'completed';

/**
 * A case (one Case Ref Number) routinely has several independent verification
 * components — present address, permanent address, employment... — each with
 * its own status/date trail. The component, not the case, is the field
 * executive's actual unit of work, so it's what the list/accept/detail
 * endpoints operate on; `caseId`/`caseRef` link back to the shared parent.
 */
export interface CaseSummary {
  readonly id: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly address: string;
  readonly bucket: CaseBucket;
  readonly updatedAt: string;
}

/** Row shape of `case_components` joined with its parent `cases` row. */
export interface CaseComponentRow {
  readonly id: string;
  readonly case_id: string;
  readonly case_ref: string;
  readonly client_name: string;
  readonly candidate_name: string;
  readonly primary_contact_number: string;
  readonly secondary_contact_number: string;
  readonly profile_status: string;
  readonly father_or_spouse_name: string;
  readonly employer_name: string;
  readonly component_status: string;
  readonly action_status: string | null;
  readonly bucket: CaseBucket;
  readonly verification_type: string;
  readonly address_type: string | null;
  readonly residence_type: string | null;
  readonly address: string;
  readonly location: string;
  readonly remarks: string;
  readonly additional_verification_instructions: string;
  readonly additional_verification_remarks: string;
  readonly assigned_field_executive_id: string | null;
  readonly assigned_to_name: string;
  readonly tat_due_at: string;
  readonly target_latitude: number;
  readonly target_longitude: number;
  readonly gps_distance_meters: number;
  readonly gps_is_within_range: number;
  readonly masked_primary_phone: string;
  readonly masked_secondary_phone: string;
  readonly client_instructions: string;
  readonly field_executive_notes: string;
  readonly selected_verification_status: string | null;
  readonly respondent_name: string | null;
  readonly respondent_relation: string | null;
  readonly received_date: string | null;
  readonly action_updated_date: string | null;
  readonly insuff_raised_date: string | null;
  readonly insuff_cleared_date: string | null;
  readonly addl_doc_requested_date: string | null;
  readonly addl_doc_cleared_date: string | null;
  readonly cost_approval_requested_date: string | null;
  readonly cost_approved_date: string | null;
  readonly cost_rejected_date: string | null;
  readonly cost_currency: string | null;
  readonly cost_amount: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface Respondent {
  readonly name: string;
  readonly relation: string;
}

export interface GpsCheck {
  readonly targetLatitude: number;
  readonly targetLongitude: number;
  readonly distanceMeters: number;
  readonly isWithinRange: boolean;
}

export interface CostRequested {
  readonly currency: string;
  readonly amount: number;
}

/** A sibling component of the same case — enough for the Case Details screen to show case-wide context. */
export interface SiblingComponent {
  readonly id: string;
  readonly verificationType: string;
  readonly addressType: string | null;
  readonly componentStatus: string;
  readonly bucket: CaseBucket;
}

/** Full Case Details payload for the verification workflow screen — one component plus its case-wide siblings. */
export interface CaseDetail {
  readonly id: string;
  readonly caseId: string;
  readonly caseRef: string;
  readonly bucket: CaseBucket;
  readonly tatDueAt: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly verificationType: string;
  readonly clientName: string;
  readonly address: string;
  readonly addressType: string | null;
  readonly residenceType: string | null;
  readonly gpsCheck: GpsCheck;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
  readonly selectedVerificationStatus: string | null;
  readonly respondent: Respondent | null;
  /** dropdown_options(category='component_status').code — the real-world status of this component. */
  readonly componentStatus: string;
  /** dropdown_options(category='action_status').code, or null while awaiting action. */
  readonly actionStatus: string | null;
  /** dropdown_options(category='profile_status').code — the whole case's aggregate status. */
  readonly profileStatus: string;
  readonly costRequested: CostRequested | null;
  readonly insuffRaisedAt: string | null;
  readonly insuffClearedAt: string | null;
  readonly addlDocRequestedAt: string | null;
  readonly addlDocClearedAt: string | null;
  readonly costApprovalRequestedAt: string | null;
  readonly costApprovedAt: string | null;
  readonly costRejectedAt: string | null;
  readonly siblingComponents: readonly SiblingComponent[];
}

export type ResidenceType = 'owned' | 'rented' | 'hostel' | 'paying_guest' | 'company_quarters' | 'relative_owned';
export type AddressType = 'present' | 'permanent' | 'previous';

/** Field executive's verification outcome, submitted once the form is complete. */
export interface VerificationOutcomeInput {
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
