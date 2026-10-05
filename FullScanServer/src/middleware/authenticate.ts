import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { verifyMobileToken } from '../services/auth.service.js';

/**
 * Requires a valid `Authorization: Bearer <token>` header, issued by POST /auth/login and
 * still the account's live mobile session — not revoked by POST /auth/logout or
 * superseded by a newer login, and for an account that still exists.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new AppError(401, 'Missing authentication token'));
    return;
  }

  let session: Awaited<ReturnType<typeof verifyMobileToken>>;

  try {
    session = await verifyMobileToken(token);
  } catch (err) {
    next(err);
    return;
  }

  if (!session) {
    next(new AppError(401, 'Invalid or expired authentication token'));
    return;
  }

  req.fieldExecutiveId = session.fieldExecutiveId;
  req.mobileSessionVersion = session.sessionVersion;
  next();
}
