import type { FieldExecutive } from './field-executive.types.js';

export interface FeWebLoginInput {
  readonly username: string;
  readonly password: string;
}

/**
 * Service-level result. The token never leaves the server in a response body — the
 * controller puts it in the httpOnly session cookie and returns only the rest.
 */
export interface FeWebLoginResult {
  readonly token: string;
  readonly expiresInSeconds: number;
  readonly fieldExecutive: FieldExecutive;
}

/**
 * Field executive **web** access-token payload.
 *
 * It carries `fieldExecutiveId` like a mobile token, so `scope` is what separates
 * the two: a web sign-in skips device binding, so a web token must never be accepted
 * by the mobile API (which relies on that binding), and a mobile token must never
 * open the web portal. Both are signed with `JWT_SECRET`; the scope claim is checked
 * in both directions.
 */
export interface FeWebJwtPayload {
  readonly fieldExecutiveId: string;
  readonly scope: 'fe_web';
}
