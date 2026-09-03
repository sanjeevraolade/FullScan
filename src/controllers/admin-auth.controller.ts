import type { Request, Response, NextFunction } from 'express';
import * as adminAuthService from '../services/admin-auth.service.js';
import { AppError } from '../utils/app-error.js';
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from '../utils/admin-session-cookie.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/v1/admin/auth/login
 * Validates admin credentials, sets the httpOnly session cookie and returns the
 * token (so non-browser clients can use the Bearer header instead).
 */
export function login(req: Request, res: Response, next: NextFunction): void {
  try {
    const result = adminAuthService.loginAdmin(req.body);

    setAdminSessionCookie(res, result.token, result.expiresInSeconds);
    logger.info({ adminUserId: result.adminUser.id }, 'Admin signed in');

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/auth/logout
 * Clears the session cookie. Tokens are stateless, so a Bearer holder keeps its
 * token until expiry — the portal, which only ever uses the cookie, is signed out.
 */
export function logout(req: Request, res: Response, next: NextFunction): void {
  try {
    clearAdminSessionCookie(res);
    logger.info({ adminUserId: req.adminUserId }, 'Admin signed out');

    res.json({ success: true, data: { signedOut: true } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/auth/me
 * Current admin's profile — the portal uses it to render the drawer header and to
 * confirm the session is still alive.
 */
export function getCurrentAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.adminUserId) {
      throw new AppError(401, 'Missing admin authentication token');
    }

    const adminUser = adminAuthService.getAdminUserProfile(req.adminUserId);
    res.json({ success: true, data: adminUser });
  } catch (err) {
    next(err);
  }
}
