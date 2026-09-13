/**
 * Roles an admin account can hold.
 * - `admin` — Cases, Field Executive History, Add New Case.
 * - `super_admin` — everything an admin can do, plus Mobile App Settings and Add New Admin.
 */
export const ADMIN_ROLES = ['admin', 'super_admin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

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
  readonly created_by: string | null;
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

/** Admin account as listed on the super admin's Add New Admin page. */
export interface AdminUserSummary extends AdminUser {
  readonly isActive: boolean;
  readonly createdAt: string;
  /** Id of the super admin who added the account; null for seeded admins. */
  readonly createdBy: string | null;
}

export interface CreateAdminUserInput {
  readonly name: string;
  readonly email: string;
  readonly role: AdminRole;
}

/** Super admin changes to another admin: promote/demote and deactivate/reactivate. */
export interface UpdateAdminUserInput {
  readonly role?: AdminRole;
  readonly isActive?: boolean;
}

/**
 * The created account plus its one-time temporary password. The password is
 * returned exactly once — only its bcrypt hash is stored, so it cannot be shown again.
 */
export interface CreateAdminUserResult {
  readonly adminUser: AdminUserSummary;
  readonly temporaryPassword: string;
}

export interface AdminLoginInput {
  /** The account's username or its email address. */
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
