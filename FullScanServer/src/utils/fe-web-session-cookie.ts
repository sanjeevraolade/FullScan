import type { Request, Response } from 'express';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie.js';

/**
 * Field Executive web portal session cookie. Deliberately a different name from the
 * admin cookie, so signing in to one portal never signs a browser out of the other.
 */
export const FE_WEB_SESSION_COOKIE = 'fs_fe_session';

export function readFeWebSessionCookie(req: Request): string | undefined {
  return readSessionCookie(req, FE_WEB_SESSION_COOKIE);
}

export function setFeWebSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
  setSessionCookie(res, FE_WEB_SESSION_COOKIE, token, maxAgeSeconds);
}

export function clearFeWebSessionCookie(res: Response): void {
  clearSessionCookie(res, FE_WEB_SESSION_COOKIE);
}
