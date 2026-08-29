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
    req.fieldExecutiveId = payload.fieldExecutiveId;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired authentication token'));
  }
}
