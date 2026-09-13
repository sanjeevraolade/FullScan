import { getDb } from './connection.js';
import type { CaseComponentRow } from '../types/case.types.js';
import type {
  AdminCaseListFilter,
  AdminCaseListItem,
  CaseCategoryCount,
  CaseRow,
} from '../types/admin-case.types.js';

/**
 * Admin reads and writes over `cases` / `case_components`.
 *
 * Kept apart from `case.dao.ts` on purpose: that one answers "what is assigned
 * to *this* field executive", this one answers "what exists at all" and is the
 * only place cases are created or edited.
 */

const LIST_SELECT = `
  SELECT
    cc.id, cc.case_id, cc.bucket, cc.verification_type, cc.address_type, cc.address,
    cc.component_status, cc.action_status, cc.assigned_field_executive_id, cc.assigned_to_name,
    cc.tat_due_at, cc.updated_at,
    c.case_ref, c.client_name, c.candidate_name, c.profile_status,
    fe.name AS assigned_field_executive_name
  FROM case_components cc
  JOIN cases c ON c.id = cc.case_id
  LEFT JOIN field_executives fe ON fe.id = cc.assigned_field_executive_id
`;

interface AdminCaseListRow {
  readonly id: string;
  readonly case_id: string;
  readonly case_ref: string;
  readonly client_name: string;
  readonly candidate_name: string;
  readonly bucket: AdminCaseListItem['bucket'];
  readonly verification_type: string;
  readonly address_type: string | null;
  readonly address: string;
  readonly component_status: string;
  readonly action_status: string | null;
  readonly profile_status: string;
  readonly assigned_field_executive_id: string | null;
  readonly assigned_field_executive_name: string | null;
  readonly assigned_to_name: string;
  readonly tat_due_at: string;
  readonly updated_at: string;
}

/** WHERE fragment + bound values shared by the list, the total and the category counts. */
function buildFilterClause(
  filter: AdminCaseListFilter,
  options: { readonly includeBucket: boolean },
): { clause: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.includeBucket && filter.bucket) {
    conditions.push('cc.bucket = ?');
    values.push(filter.bucket);
  }

  if (filter.fieldExecutiveId) {
    conditions.push('cc.assigned_field_executive_id = ?');
    values.push(filter.fieldExecutiveId);
  }

  if (filter.search) {
    conditions.push(
      '(c.case_ref LIKE ? OR c.candidate_name LIKE ? OR c.client_name LIKE ? OR cc.address LIKE ?)',
    );
    const term = `%${filter.search}%`;
    values.push(term, term, term, term);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function mapListRow(row: AdminCaseListRow): AdminCaseListItem {
  return {
    id: row.id,
    caseId: row.case_id,
    caseRef: row.case_ref,
    clientName: row.client_name,
    candidateName: row.candidate_name,
    bucket: row.bucket,
    verificationType: row.verification_type,
    addressType: row.address_type,
    address: row.address,
    componentStatus: row.component_status,
    actionStatus: row.action_status,
    profileStatus: row.profile_status,
    assignedFieldExecutiveId: row.assigned_field_executive_id,
    assignedFieldExecutiveName: row.assigned_field_executive_name,
    assignedToName: row.assigned_to_name,
    tatDueAt: row.tat_due_at,
    updatedAt: row.updated_at,
  };
}

export function findComponentsForAdmin(filter: AdminCaseListFilter): AdminCaseListItem[] {
  const db = getDb();
  const { clause, values } = buildFilterClause(filter, { includeBucket: true });

  const rows = db
    .prepare(`${LIST_SELECT} ${clause} ORDER BY cc.updated_at DESC, cc.id LIMIT ? OFFSET ?`)
    .all(...values, filter.limit, filter.offset) as AdminCaseListRow[];

  return rows.map(mapListRow);
}

export function countComponentsForAdmin(filter: AdminCaseListFilter): number {
  const db = getDb();
  const { clause, values } = buildFilterClause(filter, { includeBucket: true });

  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM case_components cc JOIN cases c ON c.id = cc.case_id ${clause}`,
    )
    .get(...values) as { total: number };

  return row.total;
}

/**
 * Per-bucket counts under the *non-bucket* part of the filter, so switching tabs
 * never changes the numbers on the tabs.
 */
export function countComponentsByBucket(filter: AdminCaseListFilter): CaseCategoryCount[] {
  const db = getDb();
  const { clause, values } = buildFilterClause(filter, { includeBucket: false });

  return db
    .prepare(
      `SELECT cc.bucket, COUNT(*) AS count
       FROM case_components cc JOIN cases c ON c.id = cc.case_id
       ${clause}
       GROUP BY cc.bucket`,
    )
    .all(...values) as CaseCategoryCount[];
}

export function findCaseById(caseId: string): CaseRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as CaseRow | undefined;
}

export function findCaseByRef(caseRef: string): CaseRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM cases WHERE case_ref = ?').get(caseRef) as CaseRow | undefined;
}

/** Components of one case, joined with their parent case and assignee name. */
export function findComponentRowsByCaseId(
  caseId: string,
): (CaseComponentRow & { assigned_field_executive_name: string | null })[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT cc.*, c.case_ref, c.client_name, c.candidate_name, c.primary_contact_number,
              c.secondary_contact_number, c.profile_status, c.father_or_spouse_name, c.employer_name,
              fe.name AS assigned_field_executive_name
       FROM case_components cc
       JOIN cases c ON c.id = cc.case_id
       LEFT JOIN field_executives fe ON fe.id = cc.assigned_field_executive_id
       WHERE cc.case_id = ?
       ORDER BY cc.created_at ASC, cc.id ASC`,
    )
    .all(caseId) as (CaseComponentRow & { assigned_field_executive_name: string | null })[];
}

export function findComponentIdsByCaseId(caseId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id FROM case_components WHERE case_id = ?')
    .all(caseId) as { id: string }[];
  return rows.map((row) => row.id);
}

/** Every column an admin write touches — insert and update bind the same shape. */
export interface CaseComponentWriteValues {
  readonly id: string;
  readonly caseId: string;
  readonly bucket: string;
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

export interface CaseWriteValues {
  readonly id: string;
  readonly caseRef: string;
  readonly clientName: string;
  readonly candidateName: string;
  readonly fatherOrSpouseName: string;
  readonly employerName: string;
  readonly primaryContactNumber: string;
  readonly secondaryContactNumber: string;
  readonly profileStatus: string;
}

export function insertCase(values: CaseWriteValues): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO cases (
       id, case_ref, client_name, candidate_name, father_or_spouse_name, employer_name,
       primary_contact_number, secondary_contact_number, profile_status
     ) VALUES (
       @id, @caseRef, @clientName, @candidateName, @fatherOrSpouseName, @employerName,
       @primaryContactNumber, @secondaryContactNumber, @profileStatus
     )`,
  ).run(values);
}

export function updateCase(values: CaseWriteValues): void {
  const db = getDb();
  db.prepare(
    `UPDATE cases SET
       case_ref = @caseRef,
       client_name = @clientName,
       candidate_name = @candidateName,
       father_or_spouse_name = @fatherOrSpouseName,
       employer_name = @employerName,
       primary_contact_number = @primaryContactNumber,
       secondary_contact_number = @secondaryContactNumber,
       profile_status = @profileStatus,
       updated_at = datetime('now')
     WHERE id = @id`,
  ).run(values);
}

export function insertCaseComponent(values: CaseComponentWriteValues): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO case_components (
       id, case_id, component_status, action_status, bucket, verification_type, address_type,
       residence_type, address, location, remarks, additional_verification_instructions,
       additional_verification_remarks, assigned_field_executive_id, assigned_to_name, tat_due_at,
       target_latitude, target_longitude, masked_primary_phone, masked_secondary_phone,
       client_instructions, field_executive_notes
     ) VALUES (
       @id, @caseId, @componentStatus, @actionStatus, @bucket, @verificationType, @addressType,
       @residenceType, @address, @location, @remarks, @additionalVerificationInstructions,
       @additionalVerificationRemarks, @assignedFieldExecutiveId, @assignedToName, @tatDueAt,
       @targetLatitude, @targetLongitude, @maskedPrimaryPhone, @maskedSecondaryPhone,
       @clientInstructions, @fieldExecutiveNotes
     )`,
  ).run(values);
}

/**
 * Updates an existing component. The verification outcome columns
 * (`selected_verification_status`, respondent, the date trail) are deliberately
 * left out — they are the field executive's record of what happened on site, not
 * something the back office overwrites from a form.
 */
export function updateCaseComponent(values: CaseComponentWriteValues): void {
  const db = getDb();
  db.prepare(
    `UPDATE case_components SET
       component_status = @componentStatus,
       action_status = @actionStatus,
       bucket = @bucket,
       verification_type = @verificationType,
       address_type = @addressType,
       residence_type = @residenceType,
       address = @address,
       location = @location,
       remarks = @remarks,
       additional_verification_instructions = @additionalVerificationInstructions,
       additional_verification_remarks = @additionalVerificationRemarks,
       assigned_field_executive_id = @assignedFieldExecutiveId,
       assigned_to_name = @assignedToName,
       tat_due_at = @tatDueAt,
       target_latitude = @targetLatitude,
       target_longitude = @targetLongitude,
       masked_primary_phone = @maskedPrimaryPhone,
       masked_secondary_phone = @maskedSecondaryPhone,
       client_instructions = @clientInstructions,
       field_executive_notes = @fieldExecutiveNotes,
       updated_at = datetime('now')
     WHERE id = @id AND case_id = @caseId`,
  ).run(values);
}

/** Runs `work` inside a SQLite transaction, so a part-written case never lands. */
export function runInTransaction<T>(work: () => T): T {
  const db = getDb();
  return db.transaction(work)();
}
