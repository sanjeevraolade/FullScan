import fs from 'fs';
import os from 'os';
import path from 'path';
import { inject } from 'vitest';

/**
 * Boots the Express app against a throwaway MongoDB database.
 *
 * Env has to be set before anything is imported: `initDb()` reads `MONGODB_URI` /
 * `MONGODB_DB` when called, and the auth services capture `JWT_SECRET` at module
 * load. Every suite gets its own database on the replica set the global setup
 * started, seeded by the initial-data migration, so each starts from the same
 * known data.
 */
const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fullscan-server-test-'));

process.env.MONGODB_URI = inject('mongoUri');
process.env.MONGODB_DB = `fullscan_test_${path.basename(testDbDir).replace(/\W/g, '_')}`;
process.env.UPLOAD_DIR = path.join(testDbDir, 'uploads');
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

const { initDb, closeDb, getCollection, getDb } = await import('../../src/db/connection.js');
await initDb();

const { app } = await import('../../src/app.js');

export { app, closeDb, getCollection, getDb, testDbDir };

/** Test credentials from the initial seed. `SEEDED_ADMIN` is the super admin. */
export const SEEDED_ADMIN = { username: 'admin001', password: 'Admin@123!', id: 'admin-001' };
export const SEEDED_REGULAR_ADMIN = {
  username: 'admin002',
  password: 'Admin@123!',
  id: 'admin-002',
  email: 'priya.nair@fullscan.test',
};
export const SEEDED_INACTIVE_ADMIN = { username: 'admin004', password: 'Admin@123!' };

/** Seeded field executive — also the account the mobile app uses. */
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

export async function removeTestDb(): Promise<void> {
  await getDb().dropDatabase();
  await closeDb();
  fs.rmSync(testDbDir, { recursive: true, force: true });
}
