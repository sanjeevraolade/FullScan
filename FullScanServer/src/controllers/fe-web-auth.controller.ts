import type { Request, Response, NextFunction } from 'express';
import * as feWebAuthService from '../services/fe-web-auth.service.js';
import {
  clearFeWebSessionCookie,
  setFeWebSessionCookie,
} from '../utils/fe-web-session-cookie.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/v1/fe-web/auth/login
 * Validates field executive credentials and sets the httpOnly session cookie. The
 * token itself is deliberately not in the body — the portal never needs it.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, expiresInSeconds, fieldExecutive } = await feWebAuthService.loginFieldExecutiveWeb(
      req.body,
    );

    setFeWebSessionCookie(res, token, expiresInSeconds);
    logger.info({ fieldExecutiveId: fieldExecutive.id }, 'Field executive signed in on web');

    res.json({ success: true, data: { expiresInSeconds, fieldExecutive } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/fe-web/auth/logout
 * Clears the session cookie. The web token only ever lived in that cookie, so this
 * fully signs the browser out.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    clearFeWebSessionCookie(res);
    logger.info({ fieldExecutiveId: req.fieldExecutiveId }, 'Field executive signed out on web');

    res.json({ success: true, data: { signedOut: true } });
  } catch (err) {
    next(err);
  }
}
