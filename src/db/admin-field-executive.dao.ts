import { getDb } from './connection.js';
import type {
  AdminFieldExecutiveRow,
  FieldExecutiveComponentRow,
} from '../types/admin-field-executive.types.js';
import type { MockLocationEventRow } from '../types/mock-location.types.js';

/**
 * Admin reads over field executives and the evidence trail behind them.
 *
 * `mock_location_events.case_id` holds a **case component** id — the app reports
 * whatever it was working on, and its unit of work is the component — so history
 * joins detections to `case_components`, not to `cases`.
 */

const LIST_SELECT = `
  SELECT
    fe.id, fe.name, fe.email, fe.role, fe.username, fe.device_id,
    (SELECT COUNT(*) FROM case_components cc
       WHERE cc.assigned_field_executive_id = fe.id AND cc.bucket != 'new')
      AS assigned_component_count,
    (SELECT COUNT(*) FROM mock_location_events e WHERE e.field_executive_id = fe.id)
      AS mock_location_event_count,
    (SELECT MAX(e.detected_at) FROM mock_location_events e WHERE e.field_executive_id = fe.id)
      AS last_mock_location_detected_at
  FROM field_executives fe
`;

/**
 * The picker list. Executives with detections are floated to the top — a fraud
 * review starts there, and the seeded roster is 51 names long.
 */
export function findFieldExecutivesForAdmin(search?: string): AdminFieldExecutiveRow[] {
  const db = getDb();
  const values: unknown[] = [];
  let clause = '';

  if (search) {
    clause = 'WHERE fe.name LIKE ? OR fe.username LIKE ? OR fe.email LIKE ?';
    const term = `%${search}%`;
    values.push(term, term, term);
  }

  return db
    .prepare(
      `${LIST_SELECT} ${clause}
       ORDER BY mock_location_event_count DESC, last_mock_location_detected_at DESC, fe.name ASC`,
    )
    .all(...values) as AdminFieldExecutiveRow[];
}

export function findFieldExecutiveForAdmin(id: string): AdminFieldExecutiveRow | undefined {
  const db = getDb();
  return db.prepare(`${LIST_SELECT} WHERE fe.id = ?`).get(id) as
    | AdminFieldExecutiveRow
    | undefined;
}

/**
 * Components this executive actually holds, newest activity first.
 *
 * The `new` bucket is excluded: it is the shared pool of unclaimed work, which
 * the mobile app re-draws at random on every request, so a New row says nothing
 * about what this executive has done. Accepting a case is what claims it, and
 * that moves it to `pending`.
 */
export function findComponentsAssignedToFieldExecutive(
  fieldExecutiveId: string,
): FieldExecutiveComponentRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         cc.id, cc.case_id, cc.verification_type, cc.address_type, cc.address, cc.bucket,
         cc.component_status, cc.action_status, cc.tat_due_at, cc.updated_at,
         c.case_ref, c.client_name, c.candidate_name
       FROM case_components cc
       JOIN cases c ON c.id = cc.case_id
       WHERE cc.assigned_field_executive_id = ? AND cc.bucket != 'new'
       ORDER BY cc.updated_at DESC`,
    )
    .all(fieldExecutiveId) as FieldExecutiveComponentRow[];
}

/** Every detection recorded against this executive, most recent first. */
export function findMockLocationEventsForFieldExecutive(
  fieldExecutiveId: string,
): MockLocationEventRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM mock_location_events WHERE field_executive_id = ? ORDER BY detected_at DESC',
    )
    .all(fieldExecutiveId) as MockLocationEventRow[];
}

/**
 * Components a detection points at that the executive is no longer assigned —
 * reassignment must not hide the case a detection happened on.
 */
export function findComponentsByIds(componentIds: readonly string[]): FieldExecutiveComponentRow[] {
  if (componentIds.length === 0) {
    return [];
  }

  const db = getDb();
  const placeholders = componentIds.map(() => '?').join(', ');

  return db
    .prepare(
      `SELECT
         cc.id, cc.case_id, cc.verification_type, cc.address_type, cc.address, cc.bucket,
         cc.component_status, cc.action_status, cc.tat_due_at, cc.updated_at,
         c.case_ref, c.client_name, c.candidate_name
       FROM case_components cc
       JOIN cases c ON c.id = cc.case_id
       WHERE cc.id IN (${placeholders})`,
    )
    .all(...componentIds) as FieldExecutiveComponentRow[];
}

/** Distinct handsets detections came from — more than one is itself a signal. */
export function countDistinctMockLocationDevices(fieldExecutiveId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT device_id) AS total
       FROM mock_location_events
       WHERE field_executive_id = ? AND device_id IS NOT NULL`,
    )
    .get(fieldExecutiveId) as { total: number };

  return row.total;
}
