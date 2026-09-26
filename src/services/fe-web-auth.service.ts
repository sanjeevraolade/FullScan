import jwt from 'jsonwebtoken';
import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { toFieldExecutive } from './field-executive.service.js';
import { AppError } from '../utils/app-error.js';
import { verifyPassword } from '../utils/password.js';
import type {
  FeWebJwtPayload,
  FeWebLoginInput,
  FeWebLoginResult,
} from '../types/fe-web-auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * Web sessions are shorter than the mobile app's 12h token: a browser is more
 * likely to be a shared or borrowed machine than an FE's own bound handset.
 */
export const FE_WEB_TOKEN_EXPIRY_SECONDS = 8 * 60 * 60;

/** Single message for every credential failure — never reveals which half was wrong. */
const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password';

/**
 * Validates field executive credentials for the web portal and issues a
 * web-scoped token.
 *
 * Same accounts and passwords as the mobile app, but **no device binding**: a
 * browser has no stable device identity, and binding one would lock the FE out of
 * their handset. The account's mobile device binding is neither checked nor changed.
 */
export async function loginFieldExecutiveWeb({ username, password }: FeWebLoginInput): Promise<FeWebLoginResult> {
  const row = await fieldExecutiveDao.findFieldExecutiveByUsername(username.trim());
  const isPasswordValid = verifyPassword(password, row?.password_hash);

  if (!row || !isPasswordValid) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  const payload: FeWebJwtPayload = { fieldExecutiveId: row.id, scope: 'fe_web' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: FE_WEB_TOKEN_EXPIRY_SECONDS });

  return {
    token,
    expiresInSeconds: FE_WEB_TOKEN_EXPIRY_SECONDS,
    fieldExecutive: toFieldExecutive(row),
  };
}

/**
 * Verifies a web portal token. Returns undefined for anything that is not a
 * currently-valid web token for an existing field executive — including a
 * structurally valid mobile or admin token, which lack `scope: 'fe_web'`.
 */
export async function verifyFeWebToken(token: string): Promise<FeWebJwtPayload | undefined> {
  let payload: FeWebJwtPayload;

  try {
    payload = jwt.verify(token, JWT_SECRET) as FeWebJwtPayload;
  } catch {
    return undefined;
  }

  if (payload.scope !== 'fe_web' || !payload.fieldExecutiveId) {
    return undefined;
  }

  // A deleted account must stop working before its token expires.
  if (!(await fieldExecutiveDao.findFieldExecutiveById(payload.fieldExecutiveId))) {
    return undefined;
  }

  return payload;
}
