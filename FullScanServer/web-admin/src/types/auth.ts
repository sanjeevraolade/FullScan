export type AdminRole = 'admin' | 'super_admin';

export interface AdminUser {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly lastLoginAt: string | null;
}

export interface LoginCredentials {
  /** Username or email address — the server accepts either. */
  readonly username: string;
  readonly password: string;
}

export interface LoginResult {
  readonly expiresInSeconds: number;
  readonly adminUser: AdminUser;
}

/**
 * `checking` until the first `/auth/me` answers — the session is an httpOnly cookie
 * the app cannot read. `unavailable` means the server could not be reached to ask.
 */
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'unavailable';
