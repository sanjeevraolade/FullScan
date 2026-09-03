import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as adminUserDao from '../db/admin-user.dao.js';
import { AppError } from '../utils/app-error.js';
import type {
  AdminJwtPayload,
  AdminLoginInput,
  AdminLoginResult,
  AdminUser,
  AdminUserRow,
} from '../types/admin.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/** Admin sessions are shorter-lived than the mobile app's 12h field-executive token. */
export const ADMIN_TOKEN_EXPIRY_SECONDS = 8 * 60 * 60;

/**
 * Compared against when the username does not exist, so a missing account costs
 * the same time as a wrong password and cannot be probed for user enumeration.
 * (bcrypt hash of a value no one can submit.)
 */
const DUMMY_PASSWORD_HASH = '$2a$10$UDK0XJ6Bd3vhv7ScA0iiwuZ.tG3zuUmiq73Vx5DnscZo7lKQlymua';

/** Single message for every credential failure — never reveals which half was wrong. */
const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password';

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * Validates admin credentials and issues an admin-scoped access token.
 * Rejects unknown usernames, wrong passwords and deactivated accounts alike.
 */
export function loginAdmin({ username, password }: AdminLoginInput): AdminLoginResult {
  const row = adminUserDao.findAdminUserByUsername(username);
  const isPasswordValid = bcrypt.compareSync(password, row?.password_hash || DUMMY_PASSWORD_HASH);

  if (!row || !isPasswordValid) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if (row.is_active !== 1) {
    throw new AppError(403, 'This admin account has been deactivated. Contact a super admin.');
  }

  const payload: AdminJwtPayload = {
    adminUserId: row.id,
    username: row.username,
    role: row.role,
    scope: 'admin',
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: ADMIN_TOKEN_EXPIRY_SECONDS });

  adminUserDao.touchAdminUserLastLogin(row.id);

  return {
    token,
    expiresInSeconds: ADMIN_TOKEN_EXPIRY_SECONDS,
    adminUser: toAdminUser(row),
  };
}

/**
 * Verifies an admin access token. Returns undefined for anything that is not a
 * currently-valid token belonging to an active admin — including a structurally
 * valid *field executive* token, which is signed with the same secret but lacks
 * the `scope: 'admin'` claim.
 */
export function verifyAdminToken(token: string): AdminJwtPayload | undefined {
  let payload: AdminJwtPayload;

  try {
    payload = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
  } catch {
    return undefined;
  }

  if (payload.scope !== 'admin' || !payload.adminUserId) {
    return undefined;
  }

  // An account deactivated mid-session must stop working before its token expires.
  const row = adminUserDao.findAdminUserById(payload.adminUserId);
  if (!row || row.is_active !== 1) {
    return undefined;
  }

  return payload;
}

/** Current admin's profile, for the portal header. */
export function getAdminUserProfile(adminUserId: string): AdminUser {
  const row = adminUserDao.findAdminUserById(adminUserId);

  if (!row) {
    throw new AppError(404, 'Admin user not found');
  }

  return toAdminUser(row);
}
