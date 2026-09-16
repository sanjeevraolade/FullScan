import { getDb } from './connection.js';
import type { CaseEvidenceRow, CaseEvidenceWithUploaderRow } from '../types/fe-web-evidence.types.js';

export type NewCaseEvidenceRow = Omit<CaseEvidenceRow, 'uploaded_at' | 'source'>;

export function findEvidenceByComponent(componentId: string): CaseEvidenceRow[] {
  return getDb()
    .prepare('SELECT * FROM case_evidence WHERE component_id = ? ORDER BY uploaded_at DESC, rowid DESC')
    .all(componentId) as CaseEvidenceRow[];
}

/** Evidence for every component of a case, with the uploading executive. */
export function findEvidenceByCase(caseId: string): CaseEvidenceWithUploaderRow[] {
  return getDb()
    .prepare(
      `SELECT ce.*, fe.name AS field_executive_name, fe.username AS field_executive_username
      FROM case_evidence ce
      JOIN case_components cc ON cc.id = ce.component_id
      JOIN field_executives fe ON fe.id = ce.field_executive_id
      WHERE cc.case_id = ?
      ORDER BY ce.uploaded_at DESC, ce.rowid DESC`,
    )
    .all(caseId) as CaseEvidenceWithUploaderRow[];
}

/** Inserts every row or none. */
export function insertEvidenceRows(rows: readonly NewCaseEvidenceRow[]): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO case_evidence
      (id, component_id, field_executive_id, original_name, storage_path, mime_type, size_bytes, sha256)
    VALUES
      (@id, @component_id, @field_executive_id, @original_name, @storage_path, @mime_type, @size_bytes, @sha256)`,
  );

  db.transaction((entries: readonly NewCaseEvidenceRow[]) => {
    for (const entry of entries) {
      insert.run(entry);
    }
  })(rows);
}
