import type { AdminRole, AdminUser } from './auth';

export interface AdminUserSummary extends AdminUser {
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface CreateAdminUserInput {
  readonly name: string;
  readonly email: string;
  readonly role: AdminRole;
}

export interface UpdateAdminUserInput {
  readonly role?: AdminRole;
  readonly isActive?: boolean;
}

export interface CreateAdminUserResult {
  readonly adminUser: AdminUserSummary;
  /** Shown exactly once — only its hash is stored. */
  readonly temporaryPassword: string;
}
