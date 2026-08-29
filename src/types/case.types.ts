export type CaseBucket = 'new' | 'pending' | 'beyond_tat' | 'completed';

export interface CaseSummary {
  readonly id: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly verificationType: string;
  readonly address: string;
  readonly bucket: CaseBucket;
  readonly updatedAt: string;
}

export interface CaseRow {
  readonly id: string;
  readonly case_ref: string;
  readonly client_name: string;
  readonly candidate_name: string;
  readonly verification_type: string;
  readonly address: string;
  readonly bucket: CaseBucket;
  readonly assigned_field_executive_id: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly father_or_spouse_name: string;
  readonly employer_name: string;
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

/** Full Case Details payload for the verification workflow screen. */
export interface CaseDetail {
  readonly id: string;
  readonly caseRef: string;
  readonly bucket: CaseBucket;
  readonly tatDueAt: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly verificationType: string;
  readonly clientName: string;
  readonly address: string;
  readonly gpsCheck: GpsCheck;
  readonly maskedPrimaryPhone: string;
  readonly maskedSecondaryPhone: string;
  readonly clientInstructions: string;
  readonly fieldExecutiveNotes: string;
  readonly selectedVerificationStatus: string | null;
  readonly respondent: Respondent | null;
}

export type ResidenceType = 'owned' | 'rented' | 'hostel';
export type AddressType = 'present' | 'permanent';

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
