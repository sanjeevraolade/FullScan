export interface FieldExecutive {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

export interface LoginResult {
  readonly expiresInSeconds: number;
  readonly fieldExecutive: FieldExecutive;
}

/**
 * `checking` until the first `/auth/me` answers. The session itself is an httpOnly
 * cookie the app can never read, so asking the server is the only way to know.
 * `unavailable` means the server could not be reached to ask.
 */
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'unavailable';
