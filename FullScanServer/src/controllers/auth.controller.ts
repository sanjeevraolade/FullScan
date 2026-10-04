import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

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
