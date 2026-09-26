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
export async function authenticateFeWeb(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readFeWebSessionCookie(req);

  if (!token) {
    next(new AppError(401, 'Missing field executive web session'));
    return;
  }

  let payload: Awaited<ReturnType<typeof verifyFeWebToken>>;

  try {
    payload = await verifyFeWebToken(token);
  } catch (err) {
    next(err);
    return;
  }

  if (!payload) {
    next(new AppError(401, 'Invalid or expired session'));
    return;
  }

  req.fieldExecutiveId = payload.fieldExecutiveId;
  next();
}

/**
 * Builds a guard for field executive web **page** routes. An unauthenticated browser
 * is redirected to `loginPath` (carrying `next`) instead of being shown JSON.
 */
export function createFeWebPageGuard(
  loginPath: string,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = readFeWebSessionCookie(req);
    let payload: Awaited<ReturnType<typeof verifyFeWebToken>>;

    try {
      payload = token ? await verifyFeWebToken(token) : undefined;
    } catch (err) {
      next(err);
      return;
    }

    if (!payload) {
      res.redirect(`${loginPath}?next=${encodeURIComponent(req.originalUrl)}`);
      return;
    }

    req.fieldExecutiveId = payload.fieldExecutiveId;
    next();
  };
}

/** Page guard for the static portal at `/fe`. */
export const authenticateFeWebPage = createFeWebPageGuard(FE_WEB_LOGIN_PATH);
