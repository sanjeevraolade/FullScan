import { getDb } from './connection.js';
import type {
  DeviceChangeRequestDetailRow,
  DeviceChangeRequestFilter,
  DeviceChangeRequestStatus,
  DeviceReleaseReason,
  FieldExecutiveDeviceRow,
} from '../types/device-change.types.js';

/**
 * Device change requests and device binding history.
 *
 * Nothing here deletes a row. Requests move from `pending` to a decision once;
 * bindings are opened and later closed — both are the audit trail.
 */

/** Runs `work` in one SQLite transaction; a thrown error rolls everything back. */
export function runInTransaction<T>(work: () => T): T {
  return getDb().transaction(work)();
}

const REQUEST_SELECT = `
  SELECT
    r.*,
    fe.name AS fe_name,
    fe.username AS fe_username,
    a.name AS decided_by_name,
    d.device_id AS new_device_id,
    d.device_details AS new_device_details,
    d.bound_at AS new_bound_at,
    d.last_login_at AS new_last_login_at
  FROM device_change_requests r
  JOIN field_executives fe ON fe.id = r.field_executive_id
  LEFT JOIN admin_users a ON a.id = r.decided_by
  LEFT JOIN field_executive_devices d ON d.bound_after_request_id = r.id
`;

export function findDeviceChangeRequestById(id: string): DeviceChangeRequestDetailRow | undefined {
  return getDb().prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id) as
    | DeviceChangeRequestDetailRow
    | undefined;
}

export function findDeviceChangeRequestsForFieldExecutive(
  fieldExecutiveId: string,
): DeviceChangeRequestDetailRow[] {
  return getDb()
    .prepare(`${REQUEST_SELECT} WHERE r.field_executive_id = ? ORDER BY r.requested_at DESC, r.rowid DESC`)
    .all(fieldExecutiveId) as DeviceChangeRequestDetailRow[];
}

export function listDeviceChangeRequests(
  filter: DeviceChangeRequestFilter,
): DeviceChangeRequestDetailRow[] {
  const clauses: string[] = [];
  const values: string[] = [];

  if (filter.status) {
    clauses.push('r.status = ?');
    values.push(filter.status);
  }
  if (filter.fieldExecutiveId) {
    clauses.push('r.field_executive_id = ?');
    values.push(filter.fieldExecutiveId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  return getDb()
    .prepare(`${REQUEST_SELECT} ${where} ORDER BY r.requested_at DESC, r.rowid DESC`)
    .all(...values) as DeviceChangeRequestDetailRow[];
}

export function countDeviceChangeRequestsByStatus(
  fieldExecutiveId?: string,
): Array<{ status: DeviceChangeRequestStatus; total: number }> {
  const where = fieldExecutiveId ? 'WHERE field_executive_id = ?' : '';
  const values = fieldExecutiveId ? [fieldExecutiveId] : [];

  return getDb()
    .prepare(`SELECT status, COUNT(*) AS total FROM device_change_requests ${where} GROUP BY status`)
    .all(...values) as Array<{ status: DeviceChangeRequestStatus; total: number }>;
}

/** `requested_at` of every request inside the rolling window, oldest first. */
export function findRequestTimesInWindow(fieldExecutiveId: string, windowDays: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT requested_at FROM device_change_requests
       WHERE field_executive_id = ? AND requested_at > datetime('now', ?)
       ORDER BY requested_at ASC`,
    )
    .all(fieldExecutiveId, `-${windowDays} days`) as Array<{ requested_at: string }>;

  return rows.map((row) => row.requested_at);
}

export function findPendingDeviceChangeRequestId(fieldExecutiveId: string): string | undefined {
  const row = getDb()
    .prepare("SELECT id FROM device_change_requests WHERE field_executive_id = ? AND status = 'pending' LIMIT 1")
    .get(fieldExecutiveId) as { id: string } | undefined;

  return row?.id;
}

export function insertDeviceChangeRequest(input: {
  id: string;
  fieldExecutiveId: string;
  reason: string | null;
  deviceId: string;
  deviceDetails: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO device_change_requests (id, field_executive_id, reason, device_id, device_details)
       VALUES (@id, @fieldExecutiveId, @reason, @deviceId, @deviceDetails)`,
    )
    .run(input);
}

/** Records a decision on a still-pending request. Returns false if it was no longer pending. */
export function decideDeviceChangeRequest(
  id: string,
  status: Exclude<DeviceChangeRequestStatus, 'pending'>,
  adminUserId: string,
  note: string | null,
): boolean {
  const result = getDb()
    .prepare(
      `UPDATE device_change_requests
       SET status = ?, decided_by = ?, decided_at = datetime('now'), decision_note = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(status, adminUserId, note, id);

  return result.changes === 1;
}

/* -------------------------------------------------------------- bindings */

export function findOpenDeviceBinding(fieldExecutiveId: string): FieldExecutiveDeviceRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM field_executive_devices
       WHERE field_executive_id = ? AND released_at IS NULL
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(fieldExecutiveId) as FieldExecutiveDeviceRow | undefined;
}

export function findDeviceHistoryForFieldExecutive(fieldExecutiveId: string): FieldExecutiveDeviceRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM field_executive_devices
       WHERE field_executive_id = ?
       ORDER BY created_at DESC, rowid DESC`,
    )
    .all(fieldExecutiveId) as FieldExecutiveDeviceRow[];
}

/**
 * Opens a binding history row.
 * `isFirstLogin` stamps `bound_at` and `last_login_at` with now; a backfilled row
 * for a binding that predates history leaves both NULL.
 */
export function insertDeviceBinding(input: {
  id: string;
  fieldExecutiveId: string;
  deviceId: string;
  deviceDetails: string | null;
  isFirstLogin: boolean;
  boundAfterRequestId: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO field_executive_devices
         (id, field_executive_id, device_id, device_details, bound_at, last_login_at, bound_after_request_id)
       VALUES (
         @id, @fieldExecutiveId, @deviceId, @deviceDetails,
         CASE WHEN @isFirstLogin = 1 THEN datetime('now') END,
         CASE WHEN @isFirstLogin = 1 THEN datetime('now') END,
         @boundAfterRequestId
       )`,
    )
    .run({ ...input, isFirstLogin: input.isFirstLogin ? 1 : 0 });
}

export function releaseDeviceBinding(
  bindingId: string,
  reason: DeviceReleaseReason,
  requestId: string | null,
): void {
  getDb()
    .prepare(
      `UPDATE field_executive_devices
       SET released_at = datetime('now'), release_reason = ?, released_by_request_id = ?
       WHERE id = ? AND released_at IS NULL`,
    )
    .run(reason, requestId, bindingId);
}

export function touchDeviceBindingLogin(bindingId: string): void {
  getDb()
    .prepare("UPDATE field_executive_devices SET last_login_at = datetime('now') WHERE id = ?")
    .run(bindingId);
}

/** The latest approved request not yet followed by a new binding. */
export function findUnfollowedApprovedRequestId(fieldExecutiveId: string): string | undefined {
  const row = getDb()
    .prepare(
      `SELECT r.id FROM device_change_requests r
       WHERE r.field_executive_id = ? AND r.status = 'approved'
         AND NOT EXISTS (SELECT 1 FROM field_executive_devices d WHERE d.bound_after_request_id = r.id)
       ORDER BY r.decided_at DESC, r.rowid DESC LIMIT 1`,
    )
    .get(fieldExecutiveId) as { id: string } | undefined;

  return row?.id;
}

/** Frees the account to bind again on its next mobile login. */
export function clearFieldExecutiveDeviceBinding(fieldExecutiveId: string): void {
  getDb()
    .prepare('UPDATE field_executives SET device_id = NULL, device_details = NULL WHERE id = ?')
    .run(fieldExecutiveId);
}
