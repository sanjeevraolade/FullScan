import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/v1/auth/login
 * Validates username + password and returns `{ token, fieldExecutive, masterDataUpdatedAt }`:
 * the session token, the field executive's profile (same shape as GET /api/v1/me) and
 * the master-data version (`string | null`, same value as GET /api/v1/master-data's
 * `updatedAt`).
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Revokes the bearer's mobile session on the server, so the token stops working before
 * it expires. Device binding is unchanged. Responds `{ signedOut: true }`, the same
 * shape as the web portals' logout.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fieldExecutiveId, mobileSessionVersion } = req;

    // `authenticate` sets both on every request it lets through; this only guards the types.
    if (!fieldExecutiveId || mobileSessionVersion === undefined) {
      throw new AppError(401, 'Missing authentication token');
    }

    await authService.logout({ fieldExecutiveId, sessionVersion: mobileSessionVersion });
    logger.info({ fieldExecutiveId }, 'Field executive signed out on mobile');

    res.json({ success: true, data: { signedOut: true } });
  } catch (err) {
    next(err);
  }
}
