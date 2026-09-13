import * as caseDao from '../db/case.dao.js';
import * as referenceDataDao from '../db/reference-data.dao.js';
import type { CaseComponentRow } from '../types/case.types.js';
import type {
  FeWebCaseBucket,
  FeWebCaseGroup,
  FeWebCaseList,
  FeWebCaseSummary,
} from '../types/fe-web-case.types.js';

/** Display order of the groups on the web home page. */
const FE_WEB_CASE_BUCKETS: readonly FeWebCaseBucket[] = ['pending', 'beyond_tat', 'completed'];

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

/** SQLite timestamps sort correctly as strings; a missing one sorts last. */
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
export function getCaseListForFieldExecutive(fieldExecutiveId: string): FeWebCaseList {
  const rows = caseDao.findComponentsByFieldExecutive(fieldExecutiveId);
  const statusLabels = new Map(
    referenceDataDao
      .findDropdownOptionsByCategory('component_status')
      .map((option) => [option.code, option.label] as const),
  );

  return {
    caseGroups: FE_WEB_CASE_BUCKETS.map((bucket) => buildGroup(bucket, rows, statusLabels)),
  };
}
