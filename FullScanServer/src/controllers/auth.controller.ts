import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

/**
 * POST /api/v1/auth/login
 * Validates username + password and returns the session token and the field
 * executive's profile (same shape as GET /api/v1/me).
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
