/**
 * A complete, valid `verified_clear` body for `POST /cases/:caseId/verification-outcome` —
 * docs/api-contracts/verification-outcome-submission.md. Every key is required; suites that
 * need another outcome spread this and override what differs.
 */
export const VERIFIED_CLEAR_OUTCOME = {
  verificationStatus: 'verified_clear',
  utvReason: null,
  utvRemarks: null,
  insufficientReason: null,
  insufficientRemarks: null,
  residenceType: 'owned',
  addressType: 'present',
  respondent: { name: 'Test Respondent', relation: 'Self' },
  isSignatureCaptured: true,
  currentLatitude: 17.4461,
  currentLongitude: 78.3821,
  distanceToCaseMeters: 98.4,
  forceProceed: false,
} as const;
