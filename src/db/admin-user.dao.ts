import { getDb } from './connection.js';
import type { AdminUserRow } from '../types/admin.types.js';

export function findAdminUserById(id: string): AdminUserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as AdminUserRow | undefined;
}

export function findAdminUserByUsername(username: string): AdminUserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as
    | AdminUserRow
    | undefined;
}

export function touchAdminUserLastLogin(id: string): void {
  const db = getDb();
  db.prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}
