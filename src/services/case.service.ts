import * as caseDao from '../db/case.dao.js';
import { AppError } from '../utils/app-error.js';
import type { CaseDetail, CaseRow, CaseSummary, VerificationOutcomeInput } from '../types/case.types.js';

function mapCase(row: CaseRow): CaseSummary {
  return {
    id: row.id,
    caseRef: row.case_ref,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    verificationType: row.verification_type,
    address: row.address,
    bucket: row.bucket,
    updatedAt: row.updated_at,
  };
}

function mapCaseDetail(row: CaseRow): CaseDetail {
  return {
    id: row.id,
    caseRef: row.case_ref,
    bucket: row.bucket,
    tatDueAt: row.tat_due_at,
    candidateName: row.candidate_name,
    fatherOrSpouseName: row.father_or_spouse_name,
    employerName: row.employer_name,
    verificationType: row.verification_type,
    clientName: row.client_name,
    address: row.address,
    gpsCheck: {
      targetLatitude: row.target_latitude,
      targetLongitude: row.target_longitude,
      distanceMeters: row.gps_distance_meters,
      isWithinRange: row.gps_is_within_range === 1,
    },
    maskedPrimaryPhone: row.masked_primary_phone,
    maskedSecondaryPhone: row.masked_secondary_phone,
    clientInstructions: row.client_instructions,
    fieldExecutiveNotes: row.field_executive_notes,
    selectedVerificationStatus: row.selected_verification_status,
    respondent:
      row.respondent_name && row.respondent_relation
        ? { name: row.respondent_name, relation: row.respondent_relation }
        : null,
  };
}

const MIN_RANDOM_NEW_CASES = 3;
const MAX_RANDOM_NEW_CASES = 10;

/**
 * Returns the current field executive's actually-assigned cases (pending,
 * beyond TAT, completed) plus a fresh random draw from the whole 'new'
 * bucket pool — the New tab simulates a live incoming-case feed, so it is
 * re-randomized on every request rather than reflecting a fixed assignment.
 * The app groups by bucket and computes tab counts client-side
 * (offline-first: fetch once, cache, filter locally).
 */
export function getCasesForCurrentFieldExecutive(fieldExecutiveId: string): CaseSummary[] {
  const assignedRows = caseDao
    .findCasesByFieldExecutive(fieldExecutiveId)
    .filter((row) => row.bucket !== 'new');

  const randomNewCount =
    MIN_RANDOM_NEW_CASES + Math.floor(Math.random() * (MAX_RANDOM_NEW_CASES - MIN_RANDOM_NEW_CASES + 1));
  const randomNewRows = caseDao.findRandomNewCases(randomNewCount);

  return [...randomNewRows, ...assignedRows].map(mapCase);
}

/**
 * Moves a case from the New bucket to Pending/In Progress, and assigns it to
 * the accepting field executive — 'new' cases are randomly drawn from the
 * whole pool per request, so acceptance is what actually claims ownership.
 */
export function acceptCase(caseId: string, fieldExecutiveId: string): CaseSummary {
  const existing = caseDao.findCaseById(caseId);

  if (!existing) {
    throw new AppError(404, `Case not found: ${caseId}`);
  }

  if (existing.bucket !== 'new') {
    throw new AppError(409, `Case ${caseId} is not in the New bucket`);
  }

  const updated = caseDao.updateCaseBucket(caseId, 'pending', fieldExecutiveId);
  return mapCase(updated);
}

/** Full Case Details payload for the verification workflow screen. */
export function getCaseDetail(caseId: string): CaseDetail {
  const existing = caseDao.findCaseById(caseId);

  if (!existing) {
    throw new AppError(404, `Case not found: ${caseId}`);
  }

  return mapCaseDetail(existing);
}

/** Records the field executive's verification outcome and moves the case to Completed. */
export function submitVerificationOutcome(caseId: string, outcome: VerificationOutcomeInput): CaseSummary {
  const existing = caseDao.findCaseById(caseId);

  if (!existing) {
    throw new AppError(404, `Case not found: ${caseId}`);
  }

  const updated = caseDao.updateCaseVerificationOutcome(caseId, outcome);
  return mapCase(updated);
}
