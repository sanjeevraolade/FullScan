import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Boots the Express app against a throwaway SQLite database.
 *
 * Env has to be set before anything is imported: `initDb()` reads `DB_PATH` when
 * called, and the auth services capture `JWT_SECRET` at module load. Migrations
 * (including the admin seed) are applied by `initDb()`, so each suite starts from
 * the same known data.
 */
const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fullscan-server-test-'));

process.env.DB_PATH = path.join(testDbDir, 'test.sqlite');
process.env.UPLOAD_DIR = path.join(testDbDir, 'uploads');
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

const { initDb, closeDb, getDb } = await import('../../src/db/connection.js');
initDb();

const { app } = await import('../../src/app.js');

export { app, closeDb, getDb, testDbDir };

/** Test credentials seeded by migration 013. `SEEDED_ADMIN` is the super admin. */
export const SEEDED_ADMIN = { username: 'admin001', password: 'Admin@123!', id: 'admin-001' };
export const SEEDED_REGULAR_ADMIN = {
  username: 'admin002',
  password: 'Admin@123!',
  id: 'admin-002',
  email: 'priya.nair@fullscan.test',
};
export const SEEDED_INACTIVE_ADMIN = { username: 'admin004', password: 'Admin@123!' };

/** Field executive seeded by migrations 002/007 — also the account the mobile app uses. */
export const SEEDED_FIELD_EXECUTIVE = { username: 'fe001', password: 'Password123!', id: 'fe-001' };

/**
 * Pulls a session cookie (`name=value`) out of a login response's Set-Cookie header.
 * Defaults to the admin cookie; pass `fs_fe_session` for the field executive web portal.
 */
export function extractSessionCookie(
  setCookieHeader: string[] | undefined,
  cookieName = 'fs_admin_session',
): string {
  const cookie = (setCookieHeader || []).find((value) => value.startsWith(`${cookieName}=`));

  if (!cookie) {
    throw new Error(`No ${cookieName} cookie was set`);
  }

  return cookie.split(';')[0];
}

export function removeTestDb(): void {
  closeDb();
  fs.rmSync(testDbDir, { recursive: true, force: true });
}
