/** Roles an admin account can hold. `super_admin` is reserved for future privileged actions. */
export type AdminRole = 'admin' | 'super_admin';

/** Raw `admin_users` row as stored in SQLite (`is_active` is 0/1, not a boolean). */
export interface AdminUserRow {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly email: string;
  readonly password_hash: string;
  readonly role: AdminRole;
  readonly is_active: number;
  readonly last_login_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Admin account as exposed over the API — never carries `password_hash`. */
export interface AdminUser {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly lastLoginAt: string | null;
}

export interface AdminLoginInput {
  readonly username: string;
  readonly password: string;
}

export interface AdminLoginResult {
  readonly token: string;
  /** Token lifetime in seconds — the portal uses it to set its session cookie. */
  readonly expiresInSeconds: number;
  readonly adminUser: AdminUser;
}

/**
 * Admin access-token payload. `scope` is what separates an admin token from a
 * field-executive token (which carries `fieldExecutiveId` instead) — both are
 * signed with the same secret, so the scope claim must be checked, not assumed.
 */
export interface AdminJwtPayload {
  readonly adminUserId: string;
  readonly username: string;
  readonly role: AdminRole;
  readonly scope: 'admin';
}
