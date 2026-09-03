import type { Request, Response } from 'express';

/**
 * Admin session cookie helpers.
 *
 * The Admin Portal is served by this same Express app, so the access token rides
 * in an httpOnly cookie rather than localStorage: portal JavaScript can never read
 * it (so an XSS bug cannot exfiltrate a session), and page routes can be gated
 * server-side before any HTML is sent.
 *
 * Hand-rolled instead of pulling in `cookie-parser`/`cookie` — one cookie, two
 * operations, no new dependency.
 */
export const ADMIN_SESSION_COOKIE = 'fs_admin_session';

const COOKIE_PATH = '/';

/** `Secure` is omitted off-production so the portal still works over plain http://localhost. */
function isSecureContext(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Reads the admin session token from the request's Cookie header, if present. */
export function readAdminSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    if (part.slice(0, separatorIndex).trim() === ADMIN_SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }

  return undefined;
}

/**
 * Issues the session cookie.
 * `SameSite=Strict` is what protects the cookie-authenticated mutating endpoints
 * from CSRF — a cross-site request never carries it.
 */
export function setAdminSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Strict',
  ];

  if (isSecureContext()) {
    attributes.push('Secure');
  }

  res.append('Set-Cookie', attributes.join('; '));
}

/** Expires the session cookie — the only thing "logout" can do to a stateless JWT. */
export function clearAdminSessionCookie(res: Response): void {
  const attributes = [
    `${ADMIN_SESSION_COOKIE}=`,
    `Path=${COOKIE_PATH}`,
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
  ];

  if (isSecureContext()) {
    attributes.push('Secure');
  }

  res.append('Set-Cookie', attributes.join('; '));
}
