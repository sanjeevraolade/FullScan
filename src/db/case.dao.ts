import { getDb } from './connection.js';
import type { CaseBucket, CaseComponentRow, VerificationOutcomeInput } from '../types/case.types.js';

const COMPONENT_SELECT = `
  SELECT
    cc.*,
    c.case_ref, c.client_name, c.candidate_name, c.primary_contact_number, c.secondary_contact_number,
    c.profile_status, c.father_or_spouse_name, c.employer_name
  FROM case_components cc
  JOIN cases c ON c.id = cc.case_id
`;

export function findComponentsByFieldExecutive(fieldExecutiveId: string): CaseComponentRow[] {
  const db = getDb();
  const stmt = db.prepare(
    `${COMPONENT_SELECT} WHERE cc.assigned_field_executive_id = ? ORDER BY cc.updated_at DESC`,
  );
  return stmt.all(fieldExecutiveId) as CaseComponentRow[];
}

export function findComponentById(componentId: string): CaseComponentRow | undefined {
  const db = getDb();
  return db.prepare(`${COMPONENT_SELECT} WHERE cc.id = ?`).get(componentId) as CaseComponentRow | undefined;
}

export function findSiblingComponents(caseId: string, excludingComponentId: string): CaseComponentRow[] {
  const db = getDb();
  return db
    .prepare(`${COMPONENT_SELECT} WHERE cc.case_id = ? AND cc.id != ? ORDER BY cc.created_at ASC`)
    .all(caseId, excludingComponentId) as CaseComponentRow[];
}

/** Random draw from the whole 'new' bucket pool, simulating a live incoming-case feed. */
export function findRandomNewComponents(limit: number): CaseComponentRow[] {
  const db = getDb();
  const stmt = db.prepare(`${COMPONENT_SELECT} WHERE cc.bucket = 'new' ORDER BY RANDOM() LIMIT ?`);
  return stmt.all(limit) as CaseComponentRow[];
}

export function updateComponentBucket(
  componentId: string,
  bucket: CaseBucket,
  fieldExecutiveId?: string,
): CaseComponentRow {
  const db = getDb();
  if (fieldExecutiveId) {
    db.prepare(
      "UPDATE case_components SET bucket = ?, assigned_field_executive_id = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(bucket, fieldExecutiveId, componentId);
  } else {
    db.prepare("UPDATE case_components SET bucket = ?, updated_at = datetime('now') WHERE id = ?").run(
      bucket,
      componentId,
    );
  }
  return findComponentById(componentId)!;
}

/** Records the field executive's verification outcome and moves the component to Completed. */
export function updateComponentVerificationOutcome(
  componentId: string,
  outcome: VerificationOutcomeInput,
): CaseComponentRow {
  const db = getDb();
  db.prepare(
    `UPDATE case_components SET
      bucket = 'completed',
      selected_verification_status = ?,
      respondent_name = ?,
      respondent_relation = ?,
      updated_at = datetime('now')
    WHERE id = ?`,
  ).run(
    outcome.verificationStatus,
    outcome.respondent?.name ?? null,
    outcome.respondent?.relation ?? null,
    componentId,
  );
  return findComponentById(componentId)!;
}
