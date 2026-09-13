import type { Request, Response } from 'express';

/**
 * Session cookie helpers shared by the browser portals this server hosts
 * (Admin Portal at `/admin`, Field Executive web portal at `/fe`).
 *
 * The portals are served by this same Express app, so an access token rides in an
 * httpOnly cookie rather than localStorage: portal JavaScript can never read it (so
 * an XSS bug cannot exfiltrate a session), and page routes can be gated server-side
 * before any HTML is sent. Each portal uses its own cookie name, so an admin and a
 * field executive session can coexist in one browser without clobbering each other.
 *
 * Hand-rolled instead of pulling in `cookie-parser`/`cookie` — a couple of cookies,
 * three operations, no new dependency.
 */

const COOKIE_PATH = '/';

/** `Secure` is omitted off-production so the portals still work over plain http://localhost. */
function isSecureContext(): boolean {
  return process.env.NODE_ENV === 'production';
}

function serializeCookie(cookieName: string, value: string, maxAgeSeconds: number): string {
  const attributes = [
    `${cookieName}=${value}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Strict',
  ];

  if (isSecureContext()) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

/** Reads a session token from the request's Cookie header, if present. */
export function readSessionCookie(req: Request, cookieName: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    if (part.slice(0, separatorIndex).trim() === cookieName) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }

  return undefined;
}

/**
 * Issues a session cookie.
 * `SameSite=Strict` is what protects the cookie-authenticated mutating endpoints
 * from CSRF — a cross-site request never carries it.
 */
export function setSessionCookie(
  res: Response,
  cookieName: string,
  token: string,
  maxAgeSeconds: number,
): void {
  res.append('Set-Cookie', serializeCookie(cookieName, encodeURIComponent(token), maxAgeSeconds));
}

/** Expires a session cookie — the only thing "logout" can do to a stateless JWT. */
export function clearSessionCookie(res: Response, cookieName: string): void {
  res.append('Set-Cookie', serializeCookie(cookieName, '', 0));
}
