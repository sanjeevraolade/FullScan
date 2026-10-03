import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { AppError } from '../utils/app-error.js';
import { recordMobileDeviceLogin } from './device-change.service.js';
import { toFieldExecutive } from './field-executive.service.js';
import type { LoginInput, LoginResult } from '../types/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_EXPIRY = '12h';

/**
 * Validates credentials and issues a session token together with the field executive's profile
 * (the same `toFieldExecutive()` shape `GET /me` returns). Fails unless both username and password match.
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

  const token = jwt.sign({ fieldExecutiveId: row.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  return { token, fieldExecutive: toFieldExecutive(row) };
}
