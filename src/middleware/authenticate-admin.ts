import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { verifyAdminToken } from '../services/admin-auth.service.js';
import { readAdminSessionCookie } from '../utils/admin-session-cookie.js';

/** Where the portal's login page lives, for redirecting unauthenticated page requests. */
export const ADMIN_LOGIN_PATH = '/admin/login';

/**
 * Accepts the admin token from either transport:
 * - `Authorization: Bearer <token>` — API clients, curl, tests
 * - the httpOnly session cookie — the Admin Portal running in a browser
 */
function extractAdminToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return readAdminSessionCookie(req);
}

/**
 * Guards admin **API** routes. Responds 401 so the portal's fetch layer can react,
 * rather than redirecting.
 */
export function authenticateAdmin(req: Request, _res: Response, next: NextFunction): void {
  const token = extractAdminToken(req);

  if (!token) {
    next(new AppError(401, 'Missing admin authentication token'));
    return;
  }

  const payload = verifyAdminToken(token);

  if (!payload) {
    next(new AppError(401, 'Invalid or expired admin session'));
    return;
  }

  req.adminUserId = payload.adminUserId;
  req.adminRole = payload.role;
  next();
}

/**
 * Guards admin **page** routes. An unauthenticated browser is redirected to the
 * login page (carrying `next` so it lands back where it was headed) instead of
 * being shown a JSON error.
 */
export function authenticateAdminPage(req: Request, res: Response, next: NextFunction): void {
  const token = extractAdminToken(req);
  const payload = token ? verifyAdminToken(token) : undefined;

  if (!payload) {
    res.redirect(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  req.adminUserId = payload.adminUserId;
  req.adminRole = payload.role;
  next();
}
