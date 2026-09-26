import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/app-error.js';
import type { JwtPayload } from '../types/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/** Requires a valid `Authorization: Bearer <token>` header, issued by POST /auth/login. */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new AppError(401, 'Missing authentication token'));
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Admin and FE web-portal tokens are signed with the same secret, so verifying the
    // signature is not enough. A mobile token carries a field-executive claim and no
    // scope: a web token (`scope: 'fe_web'`) has the claim too, but was issued without
    // device binding, so it must not reach the device-bound mobile API.
    if (!payload.fieldExecutiveId || payload.scope !== undefined) {
      next(new AppError(401, 'Invalid or expired authentication token'));
      return;
    }

    req.fieldExecutiveId = payload.fieldExecutiveId;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired authentication token'));
  }
}
