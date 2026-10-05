import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  app,
  extractSessionCookie,
  getCollection,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
} from './helpers/test-app.js';
import * as authService from '../src/services/auth.service.js';
import { logger } from '../src/utils/logger.js';

/**
 * Mobile logout with server-side session revocation — docs/api-contracts/mobile-logout.md.
 *
 * - Every account has a `mobile_session_version` (absent reads as 0). Mobile tokens carry it
 *   as the `sessionVersion` claim (absent reads as 0) and are accepted only while the two match.
 * - Login increments it, revoking every earlier mobile token; a refused login changes nothing.
 * - `POST /auth/logout` increments it only if it still equals the presented token's version,
 *   so a late logout never revokes a newer login's session.
 * - Device binding and device history are never touched; FE web and admin tokens are unaffected.
 *
 * Tests run in order against one database and several reuse fe001, so each reads the stored
 * version when it needs it instead of assuming a value.
 */

const LOGIN = '/api/v1/auth/login';
const LOGOUT = '/api/v1/auth/logout';
const ME = '/api/v1/me';
const COUNTS = '/api/v1/cases/counts';
const SECRET = 'test-jwt-secret';
const PASSWORD = SEEDED_FIELD_EXECUTIVE.password;
const FE_COOKIE = 'fs_fe_session';
const ADMIN_COOKIE = 'fs_admin_session';

const SIGNED_OUT = { success: true, data: { signedOut: true } };
const MISSING_TOKEN = { success: false, error: 'Missing authentication token' };
const INVALID_TOKEN = { success: false, error: 'Invalid or expired authentication token' };

interface Account {
  readonly username: string;
  readonly id: string;
}

const FE_MAIN: Account = SEEDED_FIELD_EXECUTIVE;
/** Signs in on FE_MAIN's handset and is refused — its version must stay absent. */
const FE_REFUSED: Account = { username: 'fe002', id: 'fe-002' };
/** Never signs in to the mobile app in this suite, so it keeps no stored version. */
const FE_LEGACY: Account = { username: 'fe003', id: 'fe-003' };
const FE_DELETED: Account = { username: 'fe004', id: 'fe-004' };
const FE_CONCURRENT: Account = { username: 'fe005', id: 'fe-005' };
/** Given an explicit stored version of 0. */
const FE_ZERO: Account = { username: 'fe006', id: 'fe-006' };

afterAll(async () => {
  await removeTestDb();
});

/** Each account's own handset; the first login binds it. */
function handsetOf(account: Account): string {
  return `mobile-logout-${account.id}-handset`;
}

function loginRequest(account: Account, overrides: Readonly<Record<string, unknown>> = {}) {
  const deviceId = handsetOf(account);

  return request(app)
    .post(LOGIN)
    .send({
      username: account.username,
      password: PASSWORD,
      deviceId,
      deviceDetails: {
        deviceName: 'Pixel 8',
        model: 'Pixel 8',
        brand: 'google',
        osVersion: '15',
        appVersion: '1.0',
        systemName: 'Android',
        uniqueId: deviceId,
      },
      ...overrides,
    });
}

async function login(account: Account = FE_MAIN): Promise<string> {
  const response = await loginRequest(account);

  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.data.token as string;
}

function logout(token?: string) {
  const call = request(app).post(LOGOUT);
  return token === undefined ? call : call.set('Authorization', `Bearer ${token}`);
}

function me(token: string) {
  return request(app).get(ME).set('Authorization', `Bearer ${token}`);
}

function counts(token: string) {
  return request(app).get(COUNTS).set('Authorization', `Bearer ${token}`);
}

/** The stored `mobile_session_version` — `undefined` while the field is absent, `null` if the account is gone. */
async function storedVersion(account: Account): Promise<unknown> {
  const row = await getCollection('field_executives').findOne(
    { _id: account.id },
    { projection: { mobile_session_version: 1 } },
  );
  return row ? row.mobile_session_version : null;
}

/** The stored version, reading absent as 0 the way the server does. */
async function currentVersion(account: Account): Promise<number> {
  const stored = await storedVersion(account);
  return typeof stored === 'number' ? stored : 0;
}

function claimsOf(token: string): Readonly<Record<string, unknown>> {
  const decoded = jwt.verify(token, SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Expected an object payload');
  }
  return decoded;
}

/** A correctly signed mobile token, built by hand — `sessionVersion` omitted when undefined. */
function signMobileToken(fieldExecutiveId: string, sessionVersion?: unknown, expiresInSeconds = 12 * 60 * 60): string {
  const payload = sessionVersion === undefined ? { fieldExecutiveId } : { fieldExecutiveId, sessionVersion };
  return jwt.sign(payload, SECRET, { expiresIn: expiresInSeconds });
}

async function feWebCookie(account: Account = FE_MAIN): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: account.username, password: PASSWORD });

  expect(response.status).toBe(200);
  return extractSessionCookie(response.headers['set-cookie'] as unknown as string[], FE_COOKIE);
}

describe(`POST ${LOGIN} — session version`, () => {
  it('starts an account with no stored version, then signs the incremented version into the token', async () => {
    expect(await storedVersion(FE_MAIN)).toBeUndefined();

    const first = claimsOf(await login());

    expect(first.fieldExecutiveId).toBe(FE_MAIN.id);
    expect(first.scope).toBeUndefined();
    expect(first.sessionVersion).toBe(1);
    expect(await storedVersion(FE_MAIN)).toBe(1);

    const second = claimsOf(await login());

    expect(second.sessionVersion).toBe(2);
    expect(await storedVersion(FE_MAIN)).toBe(2);
  });

  it("revokes the previous login's token: a second login leaves only the newest token working", async () => {
    const first = await login();
    const second = await login();

    expect(await me(first).then((response) => [response.status, response.body])).toEqual([401, INVALID_TOKEN]);
    expect((await counts(first)).status).toBe(401);

    const current = await me(second);
    expect(current.status).toBe(200);
    expect(current.body.data.id).toBe(FE_MAIN.id);
  });

  it('changes nothing when the login is refused (401, 400, 403)', async () => {
    const token = await login();
    const before = await storedVersion(FE_MAIN);

    expect((await loginRequest(FE_MAIN, { password: 'not-the-password' })).status).toBe(401);
    expect((await loginRequest(FE_MAIN, { deviceId: '   ' })).status).toBe(400);
    // FE_MAIN is bound to its own handset, so another phone is refused...
    expect((await loginRequest(FE_MAIN, { deviceId: 'mobile-logout-unknown-phone' })).status).toBe(403);
    // ...and FE_MAIN's handset is refused to another account.
    expect((await loginRequest(FE_REFUSED, { deviceId: handsetOf(FE_MAIN) })).status).toBe(403);

    expect(await storedVersion(FE_MAIN)).toBe(before);
    expect(await storedVersion(FE_REFUSED)).toBeUndefined();
    expect((await me(token)).status).toBe(200);
  });
});

describe(`POST ${LOGOUT}`, () => {
  it('answers 200 { signedOut: true }, after which the same token is refused on every mobile route', async () => {
    const token = await login();
    const response = await logout(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(SIGNED_OUT);

    const afterLogout = await me(token);
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body).toEqual(INVALID_TOKEN);
    expect((await counts(token)).status).toBe(401);
  });

  it('moves the stored version on by exactly one', async () => {
    const token = await login();
    const before = await currentVersion(FE_MAIN);

    expect((await logout(token)).status).toBe(200);
    expect(await storedVersion(FE_MAIN)).toBe(before + 1);
  });

  it('logs the sign-out with the field executive id and never the token', async () => {
    const token = await login();
    const info = vi.spyOn(logger, 'info');

    try {
      expect((await logout(token)).status).toBe(200);

      const signOut = info.mock.calls.find((call) => call[1] === 'Field executive signed out on mobile');
      expect(signOut?.[0]).toEqual({ fieldExecutiveId: FE_MAIN.id });
      expect(JSON.stringify(signOut)).not.toContain(token);
    } finally {
      info.mockRestore();
    }
  });

  it('refuses a request without a bearer token with 401', async () => {
    const withoutHeader = await logout();
    expect(withoutHeader.status).toBe(401);
    expect(withoutHeader.body).toEqual(MISSING_TOKEN);

    const notBearer = await request(app).post(LOGOUT).set('Authorization', `Basic ${await login()}`);
    expect(notBearer.status).toBe(401);
    expect(notBearer.body).toEqual(MISSING_TOKEN);
  });

  const INVALID_TOKENS: ReadonlyArray<readonly [string, (version: number) => string]> = [
    ['that is not a JWT', () => 'not-a-jwt'],
    [
      'signed with another secret',
      (version) => jwt.sign({ fieldExecutiveId: FE_MAIN.id, sessionVersion: version }, 'another-secret'),
    ],
    ['that has expired', (version) => signMobileToken(FE_MAIN.id, version, -10)],
    ['with a fractional sessionVersion', (version) => signMobileToken(FE_MAIN.id, version + 0.5)],
    ['with a string sessionVersion', (version) => signMobileToken(FE_MAIN.id, String(version))],
    ['with a negative sessionVersion', () => signMobileToken(FE_MAIN.id, -1)],
  ];

  it.each(INVALID_TOKENS)('refuses a token %s with 401 and changes nothing', async (_label, makeToken) => {
    await login();
    const version = await currentVersion(FE_MAIN);

    const response = await logout(makeToken(version));

    expect(response.status).toBe(401);
    expect(response.body).toEqual(INVALID_TOKEN);
    expect(await storedVersion(FE_MAIN)).toBe(version);
  });

  it("accepts a correctly signed token that carries the account's current version", async () => {
    await login();
    const token = signMobileToken(FE_MAIN.id, await currentVersion(FE_MAIN));

    expect((await me(token)).status).toBe(200);
    expect((await logout(token)).body).toEqual(SIGNED_OUT);
  });

  it('refuses a second logout with the same token with 401, without moving the version again', async () => {
    const token = await login();

    expect((await logout(token)).status).toBe(200);
    const afterFirst = await storedVersion(FE_MAIN);

    const second = await logout(token);

    expect(second.status).toBe(401);
    expect(second.body).toEqual(INVALID_TOKEN);
    expect(await storedVersion(FE_MAIN)).toBe(afterFirst);
  });

  it('lets the next login after a logout issue a working token', async () => {
    const before = await login();
    expect((await logout(before)).status).toBe(200);

    const after = await login();
    const response = await me(after);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(FE_MAIN.id);
    expect((await me(before)).status).toBe(401);
  });

  it("does not let a late logout with an older token revoke a newer login's session", async () => {
    const older = await login();
    const newer = await login();
    const version = await storedVersion(FE_MAIN);

    const late = await logout(older);

    expect(late.status).toBe(401);
    expect(late.body).toEqual(INVALID_TOKEN);
    expect(await storedVersion(FE_MAIN)).toBe(version);
    expect((await me(newer)).status).toBe(200);
    expect((await logout(newer)).status).toBe(200);
  });

  it('does not revoke a newer login when that login lands after the logout passed authentication', async () => {
    // The HTTP route cannot pause between the middleware and the update, so drive the
    // service directly: the logout carries the older session, the account is already newer.
    const older = claimsOf(await login());
    const newer = await login();
    const newerVersion = claimsOf(newer).sessionVersion;

    expect(typeof older.sessionVersion).toBe('number');
    await authService.logout({ fieldExecutiveId: FE_MAIN.id, sessionVersion: Number(older.sessionVersion) });

    expect(await storedVersion(FE_MAIN)).toBe(newerVersion);
    expect((await me(newer)).status).toBe(200);
  });

  it('leaves the device binding and device history unchanged, and the bound handset can sign in again', async () => {
    const token = await login();
    const fieldExecutives = getCollection('field_executives');
    const deviceHistory = getCollection('field_executive_devices');
    const bindingBefore = await fieldExecutives.findOne(
      { _id: FE_MAIN.id },
      { projection: { device_id: 1, device_details: 1 } },
    );
    const historyBefore = await deviceHistory.find({ field_executive_id: FE_MAIN.id }).sort({ _id: 1 }).toArray();

    expect(bindingBefore?.device_id).toBe(handsetOf(FE_MAIN));
    expect(historyBefore.length).toBeGreaterThan(0);

    expect((await logout(token)).status).toBe(200);

    expect(
      await fieldExecutives.findOne({ _id: FE_MAIN.id }, { projection: { device_id: 1, device_details: 1 } }),
    ).toEqual(bindingBefore);
    expect(await deviceHistory.find({ field_executive_id: FE_MAIN.id }).sort({ _id: 1 }).toArray()).toEqual(
      historyBefore,
    );

    // Same handset: signs in as normal. Another phone: still needs a device change request.
    expect((await me(await login())).status).toBe(200);
    expect((await loginRequest(FE_MAIN, { deviceId: 'mobile-logout-unknown-phone' })).status).toBe(403);
  });
});

describe('tokens without a sessionVersion claim (issued before revocation shipped)', () => {
  it('are accepted for an account with no stored version', async () => {
    expect(await storedVersion(FE_LEGACY)).toBeUndefined();

    const response = await me(signMobileToken(FE_LEGACY.id));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(FE_LEGACY.id);
  });

  it('can be logged out, which revokes them', async () => {
    const legacy = signMobileToken(FE_LEGACY.id);

    expect((await logout(legacy)).body).toEqual(SIGNED_OUT);
    expect(await storedVersion(FE_LEGACY)).toBe(1);
    expect((await me(legacy)).status).toBe(401);
  });

  it('are accepted, and logged out, for an account whose stored version is 0', async () => {
    await getCollection('field_executives').updateOne({ _id: FE_ZERO.id }, { $set: { mobile_session_version: 0 } });
    const legacy = signMobileToken(FE_ZERO.id);

    expect((await me(legacy)).status).toBe(200);
    expect((await logout(legacy)).body).toEqual(SIGNED_OUT);
    expect(await storedVersion(FE_ZERO)).toBe(1);
    expect((await me(legacy)).status).toBe(401);
  });

  it('are refused once the account has signed in since', async () => {
    expect(await currentVersion(FE_MAIN)).toBeGreaterThan(0);

    const response = await me(signMobileToken(FE_MAIN.id));

    expect(response.status).toBe(401);
    expect(response.body).toEqual(INVALID_TOKEN);
  });
});

describe('accounts that no longer exist', () => {
  it.each([
    ['without a sessionVersion', undefined],
    ['with sessionVersion 0', 0],
  ])('refuses a token %s for a field executive that never existed', async (_label, sessionVersion) => {
    const token = signMobileToken('fe-ghost', sessionVersion);

    expect(await me(token).then((response) => [response.status, response.body])).toEqual([401, INVALID_TOKEN]);
    expect(await logout(token).then((response) => [response.status, response.body])).toEqual([401, INVALID_TOKEN]);
  });

  it('refuses the token of a deleted account on logout and every other mobile route', async () => {
    const token = await login(FE_DELETED);
    expect((await me(token)).status).toBe(200);

    await getCollection('field_executives').deleteOne({ _id: FE_DELETED.id });

    expect(await me(token).then((response) => [response.status, response.body])).toEqual([401, INVALID_TOKEN]);
    expect((await counts(token)).status).toBe(401);
    expect(await logout(token).then((response) => [response.status, response.body])).toEqual([401, INVALID_TOKEN]);
  });
});

describe('other auth scopes', () => {
  it('refuses FE web-portal and admin tokens on the mobile logout and the mobile API', async () => {
    const webCookie = await feWebCookie();
    const webToken = decodeURIComponent(webCookie.slice(`${FE_COOKIE}=`.length));
    const adminLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });
    const adminToken = adminLogin.body.data.token as string;
    // A web-scoped token is refused even when it happens to carry the current version.
    const webTokenWithVersion = jwt.sign(
      { fieldExecutiveId: FE_MAIN.id, scope: 'fe_web', sessionVersion: await currentVersion(FE_MAIN) },
      SECRET,
      { expiresIn: '1h' },
    );
    const before = await storedVersion(FE_MAIN);

    for (const bearer of [webToken, adminToken, webTokenWithVersion]) {
      expect(await logout(bearer).then((response) => [response.status, response.body])).toEqual([401, INVALID_TOKEN]);
      expect((await me(bearer)).status).toBe(401);
    }

    expect(await storedVersion(FE_MAIN)).toBe(before);
  });

  it('does not revoke a mobile session when the same account signs in on the web portal', async () => {
    const token = await login();
    const before = await storedVersion(FE_MAIN);

    await feWebCookie();

    expect(await storedVersion(FE_MAIN)).toBe(before);
    expect((await me(token)).status).toBe(200);
  });

  it('leaves the FE web session working after a mobile logout, and its own logout still works', async () => {
    const webCookie = await feWebCookie();
    expect((await logout(await login())).status).toBe(200);

    expect((await request(app).get('/api/v1/fe-web/auth/me').set('Cookie', webCookie)).status).toBe(200);

    const webLogout = await request(app).post('/api/v1/fe-web/auth/logout').set('Cookie', webCookie);
    expect(webLogout.status).toBe(200);
    expect(webLogout.body).toEqual(SIGNED_OUT);
  });

  it('leaves the admin logout working', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });
    const adminCookie = extractSessionCookie(adminLogin.headers['set-cookie'] as unknown as string[], ADMIN_COOKIE);
    expect((await logout(await login())).status).toBe(200);

    const adminLogout = await request(app).post('/api/v1/admin/auth/logout').set('Cookie', adminCookie);

    expect(adminLogout.status).toBe(200);
    expect(adminLogout.body).toEqual(SIGNED_OUT);
  });
});

describe('concurrent logins', () => {
  it('issue distinct versions, and only the later one stays valid', async () => {
    // Bind the handset first, so the two concurrent logins only stamp the existing binding.
    await login(FE_CONCURRENT);

    const tokens = await Promise.all([login(FE_CONCURRENT), login(FE_CONCURRENT)]);
    const versions = tokens.map((token) => Number(claimsOf(token).sessionVersion));
    const statuses = await Promise.all(tokens.map(async (token) => (await me(token)).status));
    const latest = Math.max(...versions);

    expect(new Set(versions).size).toBe(2);
    expect(await storedVersion(FE_CONCURRENT)).toBe(latest);
    expect(statuses).toEqual(versions.map((version) => (version === latest ? 200 : 401)));
  });
});

describe('field_executives.mobile_session_version validator', () => {
  it.each([null, 1.5, -1, '1'])('refuses %j', async (value) => {
    await expect(
      getCollection('field_executives').updateOne({ _id: FE_REFUSED.id }, { $set: { mobile_session_version: value } }),
    ).rejects.toThrow(/Document failed validation/);
  });
});
