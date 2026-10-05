import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { AppError } from '../utils/app-error.js';
import { recordMobileDeviceLogin } from './device-change.service.js';
import { toFieldExecutive } from './field-executive.service.js';
import { getMasterDataUpdatedAt } from './reference-data.service.js';
import type { JwtPayload, LoginInput, LoginResult, MobileSession } from '../types/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_EXPIRY = '12h';

/**
 * Validates credentials and issues a session token together with the field executive's profile
 * (the same `toFieldExecutive()` shape `GET /me` returns) and the current master-data version,
 * which the app compares with its cached `GET /master-data` copy to decide whether to re-fetch.
 * Fails unless both username and password match.
 *
 * The token carries the account's new mobile session version, so a successful login
 * revokes every mobile token issued before it; a refused login changes nothing.
 */
export async function login({ username, password, deviceId, deviceDetails }: LoginInput): Promise<LoginResult> {
  const row = await fieldExecutiveDao.findFieldExecutiveByUsername(username);
  const isPasswordValid = row ? bcrypt.compareSync(password, row.password_hash) : false;

  if (!row || !isPasswordValid) {
    throw new AppError(401, 'Invalid username or password');
  }

  // Validate deviceId is provided
  if (!deviceId || !deviceId.trim()) {
    throw new AppError(400, 'Device ID is required');
  }

  // Check if this device is already bound to a DIFFERENT user
  const deviceBoundUser = await fieldExecutiveDao.findFieldExecutiveByDeviceId(deviceId);
  if (deviceBoundUser && deviceBoundUser.id !== row.id) {
    // Device is bound to a different user
    let boundUserName = 'another user';
    if (deviceBoundUser.name) {
      boundUserName = deviceBoundUser.name;
    }
    throw new AppError(
      403,
      `This device is already bound to ${boundUserName}. Please contact admin to change device binding.`,
    );
  }

  // Check if this user is already bound to a DIFFERENT device
  if (row.device_id && row.device_id !== deviceId) {
    // User is trying to login from a different device
    let previousDeviceName = 'unknown device';
    if (row.device_details) {
      try {
        const storedDetails = JSON.parse(row.device_details);
        previousDeviceName = storedDetails.deviceName || 'unknown device';
      } catch (e) {
        // If we can't parse stored details, use the device ID
        previousDeviceName = row.device_id;
      }
    }
    throw new AppError(
      403,
      `This account is already logged in from ${previousDeviceName}. Request a device change from the FullScan web portal, or contact admin to change device binding.`,
    );
  }

  // Bind this device on the account's first login (or its first since an approved
  // device change), or stamp the login on the bound device — both kept in device history.
  await recordMobileDeviceLogin(row, deviceId, JSON.stringify(deviceDetails));

  // One live mobile session per account: moving the version on revokes every mobile
  // token issued before this login. Only reached once every check above has passed.
  const sessionVersion = await fieldExecutiveDao.incrementMobileSessionVersion(row.id);

  if (sessionVersion === undefined) {
    // The account was deleted while this login was being processed.
    throw new AppError(401, 'Invalid username or password');
  }

  const payload: JwtPayload = { fieldExecutiveId: row.id, sessionVersion };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  // Read only once every check above has passed — a refused login does not carry it.
  const masterDataUpdatedAt = await getMasterDataUpdatedAt();

  return { token, fieldExecutive: toFieldExecutive(row), masterDataUpdatedAt };
}

/** The `sessionVersion` claim; a token issued before session revocation shipped has none and reads as 0. */
function readSessionVersion(claim: unknown): number | undefined {
  if (claim === undefined) {
    return 0;
  }
  return typeof claim === 'number' && Number.isInteger(claim) && claim >= 0 ? claim : undefined;
}

/**
 * Verifies a mobile bearer token. Returns undefined for anything that is not a live
 * mobile session: a bad signature, an expired token, an admin or FE web-portal token,
 * a token for an account that no longer exists, or one whose session has been revoked
 * by a logout or superseded by a newer login.
 */
export async function verifyMobileToken(token: string): Promise<MobileSession | undefined> {
  let claims: Readonly<Record<string, unknown>>;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string') {
      return undefined;
    }
    claims = decoded;
  } catch {
    return undefined;
  }

  // Admin and FE web-portal tokens are signed with the same secret, so verifying the
  // signature is not enough. A mobile token carries a field-executive claim and no
  // scope: a web token (`scope: 'fe_web'`) has the claim too, but was issued without
  // device binding, so it must not reach the device-bound mobile API.
  const { fieldExecutiveId, scope } = claims;
  const sessionVersion = readSessionVersion(claims.sessionVersion);

  if (typeof fieldExecutiveId !== 'string' || !fieldExecutiveId || scope !== undefined || sessionVersion === undefined) {
    return undefined;
  }

  // A deleted account must stop working before its token expires, and only the
  // account's current session version is accepted.
  const row = await fieldExecutiveDao.findFieldExecutiveById(fieldExecutiveId);

  if (!row || (row.mobile_session_version ?? 0) !== sessionVersion) {
    return undefined;
  }

  return { fieldExecutiveId, sessionVersion };
}

/**
 * Signs a mobile session out on the server by moving the account's session version on —
 * only if it still equals the session's version, so a logout that arrives after a newer
 * login never revokes that newer session. Device binding and device history are not
 * touched: the next login on the bound handset works as normal.
 */
export async function logout({ fieldExecutiveId, sessionVersion }: MobileSession): Promise<void> {
  await fieldExecutiveDao.incrementMobileSessionVersionIfCurrent(fieldExecutiveId, sessionVersion);
}
