import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { verifyFeWebToken } from '../services/fe-web-auth.service.js';
import { readFeWebSessionCookie } from '../utils/fe-web-session-cookie.js';

/** Where the field executive web portal's login page lives. */
export const FE_WEB_LOGIN_PATH = '/fe/login';

/**
 * Guards field executive web **API** routes. Cookie-only: the web token is never
 * handed to JavaScript or returned in a body, so there is no Bearer transport to
 * accept. Responds 401 so the portal's fetch layer can react.
 */
export function authenticateFeWeb(req: Request, _res: Response, next: NextFunction): void {
  const token = readFeWebSessionCookie(req);

  if (!token) {
    next(new AppError(401, 'Missing field executive web session'));
    return;
  }

  const payload = verifyFeWebToken(token);

  if (!payload) {
    next(new AppError(401, 'Invalid or expired session'));
    return;
  }

  req.fieldExecutiveId = payload.fieldExecutiveId;
  next();
}

/**
 * Guards field executive web **page** routes. An unauthenticated browser is
 * redirected to the login page (carrying `next`) instead of being shown JSON.
 */
export function authenticateFeWebPage(req: Request, res: Response, next: NextFunction): void {
  const token = readFeWebSessionCookie(req);
  const payload = token ? verifyFeWebToken(token) : undefined;

  if (!payload) {
    res.redirect(`${FE_WEB_LOGIN_PATH}?next=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  req.fieldExecutiveId = payload.fieldExecutiveId;
  next();
}
