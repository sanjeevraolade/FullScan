import * as caseDao from '../db/case.dao.js';
import { AppError } from '../utils/app-error.js';
import type {
  CaseComponentRow,
  CaseDetail,
  CaseSummary,
  CostRequested,
  VerificationOutcomeInput,
} from '../types/case.types.js';

function mapSummary(row: CaseComponentRow): CaseSummary {
  return {
    id: row.id,
    caseId: row.case_id,
    caseRef: row.case_ref,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    verificationType: row.verification_type,
    address: row.address,
    bucket: row.bucket,
    updatedAt: row.updated_at,
  };
}

function mapCostRequested(row: CaseComponentRow): CostRequested | null {
  return row.cost_currency && row.cost_amount !== null
    ? { currency: row.cost_currency, amount: row.cost_amount }
    : null;
}

async function mapDetail(row: CaseComponentRow): Promise<CaseDetail> {
  const siblings = (await caseDao.findSiblingComponents(row.case_id, row.id)).map((sibling) => ({
    id: sibling.id,
    verificationType: sibling.verification_type,
    addressType: sibling.address_type,
    componentStatus: sibling.component_status,
    bucket: sibling.bucket,
  }));

  return {
    id: row.id,
    caseId: row.case_id,
    caseRef: row.case_ref,
    bucket: row.bucket,
    tatDueAt: row.tat_due_at,
    candidateName: row.candidate_name,
    fatherOrSpouseName: row.father_or_spouse_name,
    employerName: row.employer_name,
    verificationType: row.verification_type,
    clientName: row.client_name,
    address: row.address,
    addressType: row.address_type,
    residenceType: row.residence_type,
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
    componentStatus: row.component_status,
    actionStatus: row.action_status,
    profileStatus: row.profile_status,
    costRequested: mapCostRequested(row),
    insuffRaisedAt: row.insuff_raised_date,
    insuffClearedAt: row.insuff_cleared_date,
    addlDocRequestedAt: row.addl_doc_requested_date,
    addlDocClearedAt: row.addl_doc_cleared_date,
    costApprovalRequestedAt: row.cost_approval_requested_date,
    costApprovedAt: row.cost_approved_date,
    costRejectedAt: row.cost_rejected_date,
    siblingComponents: siblings,
  };
}

const MIN_RANDOM_NEW_COMPONENTS = 3;
const MAX_RANDOM_NEW_COMPONENTS = 10;

/**
 * Returns the current field executive's actually-assigned components
 * (pending, beyond TAT, completed) plus a fresh random draw from the whole
 * 'new' bucket pool — the New tab simulates a live incoming-case feed, so it
 * is re-randomized on every request rather than reflecting a fixed
 * assignment. The app groups by bucket and computes tab counts client-side
 * (offline-first: fetch once, cache, filter locally).
 */
export async function getCasesForCurrentFieldExecutive(fieldExecutiveId: string): Promise<CaseSummary[]> {
  const assignedRows = (await caseDao.findComponentsByFieldExecutive(fieldExecutiveId)).filter(
    (row) => row.bucket !== 'new',
  );

  const randomNewCount =
    MIN_RANDOM_NEW_COMPONENTS +
    Math.floor(Math.random() * (MAX_RANDOM_NEW_COMPONENTS - MIN_RANDOM_NEW_COMPONENTS + 1));
  const randomNewRows = await caseDao.findRandomNewComponents(randomNewCount);

  return [...randomNewRows, ...assignedRows].map(mapSummary);
}

/**
 * Moves a component from the New bucket to Pending/In Progress, and assigns
 * it to the accepting field executive — 'new' components are randomly drawn
 * from the whole pool per request, so acceptance is what actually claims
 * ownership.
 */
export async function acceptCase(componentId: string, fieldExecutiveId: string): Promise<CaseSummary> {
  const existing = await caseDao.findComponentById(componentId);

  if (!existing) {
    throw new AppError(404, `Case component not found: ${componentId}`);
  }

  if (existing.bucket !== 'new') {
    throw new AppError(409, `Case component ${componentId} is not in the New bucket`);
  }

  const updated = await caseDao.updateComponentBucket(componentId, 'pending', fieldExecutiveId);
  return mapSummary(updated);
}

/** Full Case Details payload for the verification workflow screen. */
export async function getCaseDetail(componentId: string): Promise<CaseDetail> {
  const existing = await caseDao.findComponentById(componentId);

  if (!existing) {
    throw new AppError(404, `Case component not found: ${componentId}`);
  }

  return mapDetail(existing);
}

/** Records the field executive's verification outcome and moves the component to Completed. */
export async function submitVerificationOutcome(
  componentId: string,
  outcome: VerificationOutcomeInput,
): Promise<CaseSummary> {
  const existing = await caseDao.findComponentById(componentId);

  if (!existing) {
    throw new AppError(404, `Case component not found: ${componentId}`);
  }

  const updated = await caseDao.updateComponentVerificationOutcome(componentId, outcome);
  return mapSummary(updated);
}
