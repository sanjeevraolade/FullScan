import { getDb } from './connection.js';
import type { AdminRole, AdminUserRow } from '../types/admin.types.js';

export interface AdminUserInsertValues {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: AdminRole;
  readonly createdBy: string;
}

export function findAdminUserById(id: string): AdminUserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as AdminUserRow | undefined;
}

/**
 * Sign-in lookup: matches the username exactly or the email case-insensitively.
 * A username match wins, should one account's username ever equal another's email.
 */
export function findAdminUserByLogin(identifier: string): AdminUserRow | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM admin_users
       WHERE username = @identifier OR email = @identifier COLLATE NOCASE
       ORDER BY username = @identifier DESC
       LIMIT 1`,
    )
    .get({ identifier }) as AdminUserRow | undefined;
}

/** True when `value` is already taken as an email or a username by any admin. */
export function isAdminIdentifierTaken(value: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM admin_users
       WHERE email = @value COLLATE NOCASE OR username = @value COLLATE NOCASE
       LIMIT 1`,
    )
    .get({ value });
  return row !== undefined;
}

/** Every admin account — super admins first, then by name. */
export function listAdminUsers(): AdminUserRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM admin_users
       ORDER BY role = 'super_admin' DESC, is_active DESC, name COLLATE NOCASE`,
    )
    .all() as AdminUserRow[];
}

export function insertAdminUser(values: AdminUserInsertValues): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO admin_users (id, username, name, email, password_hash, role, is_active, created_by)
     VALUES (@id, @username, @name, @email, @passwordHash, @role, 1, @createdBy)`,
  ).run(values);
}

export interface AdminUserChanges {
  readonly role?: AdminRole;
  readonly isActive?: boolean;
}

/** Applies a role and/or active-status change; untouched fields keep their value. */
export function updateAdminUser(id: string, changes: AdminUserChanges): void {
  const db = getDb();
  db.prepare(
    `UPDATE admin_users
     SET role = COALESCE(@role, role),
         is_active = COALESCE(@isActive, is_active),
         updated_at = datetime('now')
     WHERE id = @id`,
  ).run({
    id,
    role: changes.role ?? null,
    isActive: changes.isActive === undefined ? null : Number(changes.isActive),
  });
}

export interface AdminAuditReferences {
  /** Mobile app settings whose latest change this admin made. */
  readonly settingsChanged: number;
  /** Admin accounts this admin added. */
  readonly adminsAdded: number;
}

/** Rows that point at this admin through a foreign key — deleting it would orphan them. */
export function countAdminAuditReferences(id: string): AdminAuditReferences {
  const db = getDb();
  const settingsChanged = db
    .prepare('SELECT COUNT(*) AS total FROM mobile_app_settings WHERE updated_by = ?')
    .get(id) as { total: number };
  const adminsAdded = db
    .prepare('SELECT COUNT(*) AS total FROM admin_users WHERE created_by = ?')
    .get(id) as { total: number };

  return { settingsChanged: settingsChanged.total, adminsAdded: adminsAdded.total };
}

export function deleteAdminUser(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
}

export function touchAdminUserLastLogin(id: string): void {
  const db = getDb();
  db.prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}
