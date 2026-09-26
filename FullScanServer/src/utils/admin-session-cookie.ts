import type { Request, Response } from 'express';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie.js';

/** Admin Portal session cookie — see `session-cookie.ts` for why sessions ride in a cookie. */
export const ADMIN_SESSION_COOKIE = 'fs_admin_session';

/** Reads the admin session token from the request's Cookie header, if present. */
export function readAdminSessionCookie(req: Request): string | undefined {
  return readSessionCookie(req, ADMIN_SESSION_COOKIE);
}

export function setAdminSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
  setSessionCookie(res, ADMIN_SESSION_COOKIE, token, maxAgeSeconds);
}

export function clearAdminSessionCookie(res: Response): void {
  clearSessionCookie(res, ADMIN_SESSION_COOKIE);
}
