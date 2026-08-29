import { getDb } from './connection.js';
import type { CaseBucket, CaseRow, VerificationOutcomeInput } from '../types/case.types.js';

export function findCasesByFieldExecutive(fieldExecutiveId: string): CaseRow[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM cases WHERE assigned_field_executive_id = ? ORDER BY updated_at DESC',
  );
  return stmt.all(fieldExecutiveId) as CaseRow[];
}

export function findCaseById(caseId: string): CaseRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as CaseRow | undefined;
}

/** Random draw from the whole 'new' bucket pool, simulating a live incoming-case feed. */
export function findRandomNewCases(limit: number): CaseRow[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM cases WHERE bucket = 'new' ORDER BY RANDOM() LIMIT ?");
  return stmt.all(limit) as CaseRow[];
}

export function updateCaseBucket(caseId: string, bucket: CaseBucket, fieldExecutiveId?: string): CaseRow {
  const db = getDb();
  if (fieldExecutiveId) {
    db.prepare(
      "UPDATE cases SET bucket = ?, assigned_field_executive_id = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(bucket, fieldExecutiveId, caseId);
  } else {
    db.prepare("UPDATE cases SET bucket = ?, updated_at = datetime('now') WHERE id = ?").run(
      bucket,
      caseId,
    );
  }
  return findCaseById(caseId)!;
}

/** Records the field executive's verification outcome and moves the case to Completed. */
export function updateCaseVerificationOutcome(caseId: string, outcome: VerificationOutcomeInput): CaseRow {
  const db = getDb();
  db.prepare(
    `UPDATE cases SET
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
    caseId,
  );
  return findCaseById(caseId)!;
}
