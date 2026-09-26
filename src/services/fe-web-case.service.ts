import * as caseDao from '../db/case.dao.js';
import * as referenceDataDao from '../db/reference-data.dao.js';
import { AppError } from '../utils/app-error.js';
import type { CaseComponentRow } from '../types/case.types.js';
import type {
  FeWebCaseBucket,
  FeWebCaseDetail,
  FeWebCaseGroup,
  FeWebCaseList,
  FeWebCaseSummary,
} from '../types/fe-web-case.types.js';

/** Display order of the groups on the web home page. */
const FE_WEB_CASE_BUCKETS: readonly FeWebCaseBucket[] = ['pending', 'beyond_tat', 'completed'];

/** Buckets whose components still accept evidence. */
const EVIDENCE_OPEN_BUCKETS: ReadonlySet<CaseComponentRow['bucket']> = new Set(['pending', 'beyond_tat']);

async function findComponentStatusLabels(): Promise<ReadonlyMap<string, string>> {
  return new Map(
    (await referenceDataDao.findDropdownOptionsByCategory('component_status')).map(
      (option) => [option.code, option.label] as const,
    ),
  );
}

function isWebVisibleBucket(bucket: CaseComponentRow['bucket']): bucket is FeWebCaseBucket {
  return (FE_WEB_CASE_BUCKETS as readonly string[]).includes(bucket);
}

function mapCase(row: CaseComponentRow, statusLabels: ReadonlyMap<string, string>): FeWebCaseSummary {
  return {
    componentId: row.id,
    caseId: row.case_id,
    caseRef: row.case_ref,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    verificationType: row.verification_type,
    addressType: row.address_type,
    address: row.address,
    componentStatus: row.component_status,
    componentStatusLabel: statusLabels.get(row.component_status) ?? row.component_status,
    tatDueAt: row.tat_due_at,
    updatedAt: row.updated_at,
  };
}

/** Stored timestamps sort correctly as strings; a missing one sorts last. */
function compareTatDueAsc(left: CaseComponentRow, right: CaseComponentRow): number {
  if (!left.tat_due_at || !right.tat_due_at) {
    return (left.tat_due_at ? 0 : 1) - (right.tat_due_at ? 0 : 1);
  }
  return left.tat_due_at.localeCompare(right.tat_due_at);
}

function compareUpdatedDesc(left: CaseComponentRow, right: CaseComponentRow): number {
  return (right.updated_at ?? '').localeCompare(left.updated_at ?? '');
}

/**
 * Open work (Pending, Beyond TAT) is ordered by TAT due, soonest first — what
 * needs doing next. Completed work is ordered by most recent activity.
 */
function buildGroup(
  bucket: FeWebCaseBucket,
  rows: readonly CaseComponentRow[],
  statusLabels: ReadonlyMap<string, string>,
): FeWebCaseGroup {
  const comparator = bucket === 'completed' ? compareUpdatedDesc : compareTatDueAsc;
  const cases = rows
    .filter((row) => row.bucket === bucket)
    .sort(comparator)
    .map((row) => mapCase(row, statusLabels));

  return { bucket, caseCount: cases.length, cases };
}

/**
 * The signed-in field executive's own cases, one group per category. Uses the same
 * assigned-components query as the mobile `GET /cases`, so web and app agree on
 * what an executive holds.
 */
export async function getCaseListForFieldExecutive(fieldExecutiveId: string): Promise<FeWebCaseList> {
  const rows = await caseDao.findComponentsByFieldExecutive(fieldExecutiveId);
  const statusLabels = await findComponentStatusLabels();

  return {
    caseGroups: FE_WEB_CASE_BUCKETS.map((bucket) => buildGroup(bucket, rows, statusLabels)),
  };
}

/**
 * A component the signed-in executive holds, in a bucket the web shows. Anything
 * else — another executive's component, an unclaimed New one, an unknown id —
 * answers the same 404, so the endpoint cannot be used to probe for case ids.
 */
export async function findOwnComponent(
  fieldExecutiveId: string,
  componentId: string,
): Promise<CaseComponentRow & { readonly bucket: FeWebCaseBucket }> {
  const row = await caseDao.findComponentById(componentId);

  if (!row || row.assigned_field_executive_id !== fieldExecutiveId || !isWebVisibleBucket(row.bucket)) {
    throw new AppError(404, 'Case not found');
  }

  return { ...row, bucket: row.bucket };
}

export function canUploadEvidence(row: CaseComponentRow): boolean {
  return EVIDENCE_OPEN_BUCKETS.has(row.bucket);
}

/** One of the signed-in executive's own components, with its case-wide siblings. */
export async function getCaseDetailForFieldExecutive(
  fieldExecutiveId: string,
  componentId: string,
): Promise<FeWebCaseDetail> {
  const row = await findOwnComponent(fieldExecutiveId, componentId);
  const statusLabels = await findComponentStatusLabels();
  const siblings = await caseDao.findSiblingComponents(row.case_id, row.id);
  const labelFor = (code: string): string => statusLabels.get(code) ?? code;

  return {
    componentId: row.id,
    caseId: row.case_id,
    caseRef: row.case_ref,
    bucket: row.bucket,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    fatherOrSpouseName: row.father_or_spouse_name,
    employerName: row.employer_name,
    verificationType: row.verification_type,
    addressType: row.address_type,
    residenceType: row.residence_type,
    address: row.address,
    location: row.location,
    componentStatus: row.component_status,
    componentStatusLabel: labelFor(row.component_status),
    clientInstructions: row.client_instructions,
    tatDueAt: row.tat_due_at,
    updatedAt: row.updated_at,
    canUploadEvidence: canUploadEvidence(row),
    siblingComponents: siblings.map((sibling) => ({
      componentId: sibling.id,
      verificationType: sibling.verification_type,
      addressType: sibling.address_type,
      componentStatusLabel: labelFor(sibling.component_status),
      isAssignedToYou:
        sibling.assigned_field_executive_id === fieldExecutiveId && isWebVisibleBucket(sibling.bucket),
    })),
  };
}
