import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as fieldExecutiveDao from '../db/field-executive.dao.js';
import { AppError } from '../utils/app-error.js';
import type { LoginInput, LoginResult } from '../types/auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_EXPIRY = '12h';

/** Validates credentials and issues a session token. Fails unless both username and password match. */
export function login({ username, password }: LoginInput): LoginResult {
  const row = fieldExecutiveDao.findFieldExecutiveByUsername(username);
  const isPasswordValid = row ? bcrypt.compareSync(password, row.password_hash) : false;

  if (!row || !isPasswordValid) {
    throw new AppError(401, 'Invalid username or password');
  }

  const token = jwt.sign({ fieldExecutiveId: row.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  return {
    token,
    fieldExecutive: { id: row.id, name: row.name, email: row.email, role: row.role },
  };
}
