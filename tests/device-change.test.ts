import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  extractSessionCookie,
  getDb,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_REGULAR_ADMIN,
} from './helpers/test-app.js';

/**
 * Device change requests end to end: mobile login keeps device history, an FE
 * requests a change on the web, an admin approves or rejects, the request limit
 * comes from mobile app settings, and nothing is ever deleted.
 *
 * Each scenario uses its own seeded field executive so the flows stay independent.
 */

const PASSWORD = 'Password123!';
const FE_REQUESTS = '/api/v1/fe-web/device-change/requests';
const FE_OVERVIEW = '/api/v1/fe-web/device-change';
const ADMIN_REQUESTS = '/api/v1/admin/device-change-requests';
const ADMIN_SETTINGS = '/api/v1/admin/mobile-app-settings';

afterAll(() => {
  removeTestDb();
});

interface Handset {
  readonly deviceId: string;
  readonly deviceDetails: Record<string, string>;
}

function handset(deviceId: string, deviceName: string): Handset {
  return {
    deviceId,
    deviceDetails: {
      deviceName,
      model: `${deviceName} model`,
      brand: 'samsung',
      osVersion: '16',
      appVersion: '1.0',
      systemName: 'Android',
      uniqueId: deviceId,
    },
  };
}

interface DeviceRow {
  readonly id: string;
  readonly device_id: string;
  readonly bound_at: string | null;
  readonly last_login_at: string | null;
  readonly released_at: string | null;
  readonly release_reason: string | null;
  readonly released_by_request_id: string | null;
  readonly bound_after_request_id: string | null;
}

function fieldExecutiveIdFor(username: string): string {
  const row = getDb().prepare('SELECT id FROM field_executives WHERE username = ?').get(username) as
    | { id: string }
    | undefined;

  if (!row) {
    throw new Error(`No seeded field executive ${username}`);
  }
  return row.id;
}

function readBoundDeviceId(username: string): string | null {
  const row = getDb()
    .prepare('SELECT device_id FROM field_executives WHERE username = ?')
    .get(username) as { device_id: string | null };
  return row.device_id;
}

function readDeviceRows(username: string): DeviceRow[] {
  return getDb()
    .prepare('SELECT * FROM field_executive_devices WHERE field_executive_id = ? ORDER BY created_at, rowid')
    .all(fieldExecutiveIdFor(username)) as DeviceRow[];
}

function countRequestRows(username: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM device_change_requests WHERE field_executive_id = ?')
    .get(fieldExecutiveIdFor(username)) as { total: number };
  return row.total;
}

function mobileLogin(username: string, device: Handset) {
  return request(app).post('/api/v1/auth/login').send({ username, password: PASSWORD, ...device });
}

async function feCookie(username: string): Promise<string> {
  const response = await request(app).post('/api/v1/fe-web/auth/login').send({ username, password: PASSWORD });
  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

async function adminCookie(account: { username: string; password: string } = SEEDED_ADMIN): Promise<string> {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: account.username, password: account.password });
  return extractSessionCookie(response.headers['set-cookie']);
}

async function getOverview(username: string) {
  const response = await request(app).get(FE_OVERVIEW).set('Cookie', await feCookie(username));
  expect(response.status).toBe(200);
  return response.body.data;
}

async function submitRequest(username: string, body: Record<string, unknown> = {}) {
  return request(app).post(FE_REQUESTS).set('Cookie', await feCookie(username)).send(body);
}

/** Binds the handset with a mobile login, then submits a request; returns the request id. */
async function bindAndRequest(username: string, device: Handset, reason = 'Phone replaced'): Promise<string> {
  expect((await mobileLogin(username, device)).status).toBe(200);
  const response = await submitRequest(username, { reason });
  expect(response.status).toBe(201);
  return response.body.data.requests[0].id;
}

async function decide(requestId: string, decision: 'approve' | 'reject', note?: string, cookie?: string) {
  return request(app)
    .post(`${ADMIN_REQUESTS}/${requestId}/${decision}`)
    .set('Cookie', cookie ?? (await adminCookie()))
    .send(note === undefined ? {} : { note });
}

async function updateSettings(settings: Array<{ key: string; value: number }>) {
  const response = await request(app).put(ADMIN_SETTINGS).set('Cookie', await adminCookie()).send({ settings });
  expect(response.status).toBe(200);
}

async function listForAdmin(query = '') {
  const response = await request(app).get(`${ADMIN_REQUESTS}${query}`).set('Cookie', await adminCookie());
  expect(response.status).toBe(200);
  return response.body.data;
}

describe('device change limit settings', () => {
  it('seeds both limits as security settings with defaults and bounds', async () => {
    const response = await request(app).get(ADMIN_SETTINGS).set('Cookie', await adminCookie());
    const byKey = new Map(
      (response.body.data as Array<{ key: string }>).map((setting) => [setting.key, setting]),
    );

    expect(byKey.get('device_change_max_requests')).toMatchObject({
      value: 2,
      valueType: 'number',
      category: 'security',
      minValue: 1,
      maxValue: 20,
    });
    expect(byKey.get('device_change_window_days')).toMatchObject({
      value: 30,
      valueType: 'number',
      category: 'security',
      minValue: 1,
      maxValue: 365,
    });
  });

  it('refuses values outside the bounds', async () => {
    const cookie = await adminCookie();

    for (const setting of [
      { key: 'device_change_max_requests', value: 0 },
      { key: 'device_change_window_days', value: 366 },
    ]) {
      const response = await request(app).put(ADMIN_SETTINGS).set('Cookie', cookie).send({ settings: [setting] });
      expect(response.status, setting.key).toBe(400);
    }
  });
});

describe('mobile login keeps device history', () => {
  const username = 'fe010';
  const phone = handset('history-phone-a', 'Galaxy A');

  it('opens a history row on the first login', async () => {
    expect((await mobileLogin(username, phone)).status).toBe(200);

    const rows = readDeviceRows(username);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ device_id: phone.deviceId, released_at: null, bound_after_request_id: null });
    expect(rows[0].bound_at).toBeTruthy();
    expect(rows[0].last_login_at).toBeTruthy();
  });

  it('stamps later logins on the same phone without adding rows', async () => {
    getDb()
      .prepare("UPDATE field_executive_devices SET last_login_at = '2020-01-01 00:00:00' WHERE field_executive_id = ?")
      .run(fieldExecutiveIdFor(username));

    expect((await mobileLogin(username, phone)).status).toBe(200);

    const rows = readDeviceRows(username);
    expect(rows).toHaveLength(1);
    expect(rows[0].last_login_at).not.toBe('2020-01-01 00:00:00');
  });

  it('still refuses another phone while bound, and records nothing for it', async () => {
    const response = await mobileLogin(username, handset('history-phone-b', 'Galaxy B'));

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Request a device change');
    expect(readDeviceRows(username)).toHaveLength(1);
  });
});

describe('field executive requests a device change', () => {
  const username = 'fe011';
  const phone = handset('request-phone-a', 'Pixel A');

  it('cannot request without a linked phone', async () => {
    const overview = await getOverview('fe012');
    expect(overview.eligibility).toMatchObject({
      canRequest: false,
      blockedReason: 'no_device',
      policy: { maxRequests: 2, windowDays: 30 },
      requestsInWindow: 0,
    });

    const response = await submitRequest('fe012');
    expect(response.status).toBe(409);
    expect(countRequestRows('fe012')).toBe(0);
  });

  it('can request once a phone is linked', async () => {
    expect((await mobileLogin(username, phone)).status).toBe(200);

    const overview = await getOverview(username);
    expect(overview.eligibility).toMatchObject({ canRequest: true, blockedReason: null, requestsInWindow: 0 });
    expect(overview.deviceHistory).toHaveLength(1);
    expect(overview.deviceHistory[0]).toMatchObject({ isCurrent: true, device: { deviceId: phone.deviceId } });
  });

  it('records the request with the phone being given up', async () => {
    const response = await submitRequest(username, { reason: '  Screen broken  ' });

    expect(response.status).toBe(201);
    const { eligibility, requests } = response.body.data;
    expect(eligibility).toMatchObject({ canRequest: false, blockedReason: 'pending_request', requestsInWindow: 1 });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      status: 'pending',
      reason: 'Screen broken',
      decidedAt: null,
      newDevice: null,
      deviceAtRequest: { deviceId: phone.deviceId, deviceName: 'Pixel A', systemName: 'Android' },
    });
    expect(requests[0].decidedBy).toBeUndefined();
  });

  it('allows only one pending request at a time', async () => {
    const response = await submitRequest(username);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('waiting for admin approval');
    expect(countRequestRows(username)).toBe(1);
  });

  it('keeps the current phone working while the request is pending', async () => {
    expect((await mobileLogin(username, phone)).status).toBe(200);
    expect((await mobileLogin(username, handset('request-phone-b', 'Pixel B'))).status).toBe(403);
  });

  it('validates the request body', async () => {
    const cookie = await feCookie('fe010');

    const tooLong = await request(app).post(FE_REQUESTS).set('Cookie', cookie).send({ reason: 'x'.repeat(501) });
    expect(tooLong.status).toBe(400);

    const unknownField = await request(app).post(FE_REQUESTS).set('Cookie', cookie).send({ deviceId: 'mine' });
    expect(unknownField.status).toBe(400);
  });

  it('requires a web session', async () => {
    expect((await request(app).get(FE_OVERVIEW)).status).toBe(401);
    expect((await request(app).post(FE_REQUESTS).send({})).status).toBe(401);
  });
});

describe('admin reviews device change requests', () => {
  it('lists pending requests with who asked, per-status counts and filters', async () => {
    const all = await listForAdmin('?status=pending');
    const item = all.items.find(
      (candidate: { fieldExecutive: { username: string } }) => candidate.fieldExecutive.username === 'fe011',
    );

    expect(item).toMatchObject({ status: 'pending', reason: 'Screen broken', decidedBy: null });
    expect(all.counts.pending).toBeGreaterThanOrEqual(1);
    expect(all.counts.all).toBe(all.counts.pending + all.counts.approved + all.counts.rejected);

    const approvedOnly = await listForAdmin('?status=approved');
    expect(approvedOnly.items.some((candidate: { id: string }) => candidate.id === item.id)).toBe(false);

    const forExecutive = await listForAdmin(`?fieldExecutiveId=${fieldExecutiveIdFor('fe011')}`);
    expect(forExecutive.items.map((candidate: { id: string }) => candidate.id)).toEqual([item.id]);
  });

  it('rejects an unknown status filter', async () => {
    const response = await request(app).get(`${ADMIN_REQUESTS}?status=maybe`).set('Cookie', await adminCookie());
    expect(response.status).toBe(400);
  });

  it('is closed to anonymous callers and to field executive sessions', async () => {
    expect((await request(app).get(ADMIN_REQUESTS)).status).toBe(401);
    expect((await request(app).get(ADMIN_REQUESTS).set('Cookie', await feCookie('fe011'))).status).toBe(401);
  });

  it('404s an unknown request', async () => {
    expect((await decide('device-change-nope', 'approve')).status).toBe(404);
  });
});

describe('rejecting a request', () => {
  const username = 'fe011';

  it('records the decision and note, and leaves the phone linked', async () => {
    const [pending] = (await getOverview(username)).requests;
    const response = await decide(pending.id, 'reject', 'Use your current phone', await adminCookie(SEEDED_REGULAR_ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'rejected',
      decisionNote: 'Use your current phone',
      decidedBy: { id: SEEDED_REGULAR_ADMIN.id },
    });
    expect(readBoundDeviceId(username)).toBe('request-phone-a');
    expect(readDeviceRows(username).every((row) => row.released_at === null)).toBe(true);

    const overview = await getOverview(username);
    expect(overview.eligibility).toMatchObject({ canRequest: true, requestsInWindow: 1 });
    expect(overview.requests[0]).toMatchObject({ status: 'rejected', decisionNote: 'Use your current phone' });
  });

  it('cannot decide the same request twice', async () => {
    const [rejected] = (await getOverview(username)).requests;

    expect((await decide(rejected.id, 'reject')).status).toBe(409);
    expect((await decide(rejected.id, 'approve')).status).toBe(409);
    expect(readBoundDeviceId(username)).toBe('request-phone-a');
  });
});

describe('approving a request', () => {
  it('releases the binding into history and lets the FE sign in again on the old phone', async () => {
    const username = 'fe013';
    const oldPhone = handset('approve-phone-old', 'Old Phone');
    const requestId = await bindAndRequest(username, oldPhone);

    const approval = await decide(requestId, 'approve');
    expect(approval.status).toBe(200);
    expect(approval.body.data).toMatchObject({ status: 'approved', newDevice: null, decidedBy: { id: SEEDED_ADMIN.id } });

    expect(readBoundDeviceId(username)).toBeNull();
    const [released] = readDeviceRows(username);
    expect(released).toMatchObject({
      device_id: oldPhone.deviceId,
      release_reason: 'device_change_approved',
      released_by_request_id: requestId,
    });
    expect(released.released_at).toBeTruthy();

    const overview = await getOverview(username);
    expect(overview.eligibility.blockedReason).toBe('no_device');
    expect(overview.requests[0]).toMatchObject({ status: 'approved', newDevice: null });

    // "Any device, including the old one"
    expect((await mobileLogin(username, oldPhone)).status).toBe(200);

    const rows = readDeviceRows(username);
    expect(rows).toHaveLength(2);
    expect(rows[0].released_at).toBeTruthy();
    expect(rows[1]).toMatchObject({
      device_id: oldPhone.deviceId,
      released_at: null,
      bound_after_request_id: requestId,
    });

    const [item] = (await listForAdmin(`?fieldExecutiveId=${fieldExecutiveIdFor(username)}`)).items;
    expect(item.newDevice).toMatchObject({ deviceId: oldPhone.deviceId, deviceName: 'Old Phone' });
    expect(item.newDevice.boundAt).toBeTruthy();
  });

  it('records the new phone when the FE signs in on a different one, keeping every row', async () => {
    const username = 'fe014';
    const oldPhone = handset('approve-phone-a', 'Phone A');
    const newPhone = handset('approve-phone-b', 'Phone B');
    const requestId = await bindAndRequest(username, oldPhone);

    expect((await mobileLogin(username, newPhone)).status).toBe(403);
    expect((await decide(requestId, 'approve')).status).toBe(200);
    expect((await mobileLogin(username, newPhone)).status).toBe(200);

    expect(readBoundDeviceId(username)).toBe(newPhone.deviceId);
    expect(countRequestRows(username)).toBe(1);

    const overview = await getOverview(username);
    expect(overview.requests[0]).toMatchObject({
      status: 'approved',
      deviceAtRequest: { deviceId: oldPhone.deviceId },
      newDevice: { deviceId: newPhone.deviceId, deviceName: 'Phone B' },
    });
    expect(overview.deviceHistory.map((entry: { device: { deviceId: string }; isCurrent: boolean }) => [
      entry.device.deviceId,
      entry.isCurrent,
    ])).toEqual([
      [newPhone.deviceId, true],
      [oldPhone.deviceId, false],
    ]);
    expect(overview.eligibility).toMatchObject({ canRequest: true, requestsInWindow: 1 });
  });

  it('records a binding that predates device history before releasing it', async () => {
    const username = 'fe015';
    getDb()
      .prepare("UPDATE field_executives SET device_id = 'legacy-phone', device_details = ? WHERE username = ?")
      .run(JSON.stringify(handset('legacy-phone', 'Legacy Phone').deviceDetails), username);

    const response = await submitRequest(username, { reason: 'Old binding' });
    expect(response.status).toBe(201);

    expect((await decide(response.body.data.requests[0].id, 'approve')).status).toBe(200);

    const rows = readDeviceRows(username);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ device_id: 'legacy-phone', bound_at: null, release_reason: 'device_change_approved' });
    expect(readBoundDeviceId(username)).toBeNull();
  });
});

describe('request limit from mobile app settings', () => {
  const username = 'fe016';

  afterAll(async () => {
    await updateSettings([
      { key: 'device_change_max_requests', value: 2 },
      { key: 'device_change_window_days', value: 30 },
    ]);
  });

  it('blocks further requests once the limit is used, and says when the next is allowed', async () => {
    await updateSettings([{ key: 'device_change_max_requests', value: 1 }]);
    const requestId = await bindAndRequest(username, handset('limit-phone', 'Limit Phone'));
    expect((await decide(requestId, 'reject')).status).toBe(200);

    const expectedNext = (
      getDb()
        .prepare("SELECT datetime(requested_at, '+30 days') AS next FROM device_change_requests WHERE id = ?")
        .get(requestId) as { next: string }
    ).next;

    const overview = await getOverview(username);
    expect(overview.eligibility).toMatchObject({
      canRequest: false,
      blockedReason: 'limit_reached',
      requestsInWindow: 1,
      policy: { maxRequests: 1, windowDays: 30 },
      nextRequestAllowedAt: expectedNext,
    });

    const response = await submitRequest(username);
    expect(response.status).toBe(429);
    expect(response.body.error).toContain('at most 1 time every 30 days');
    expect(countRequestRows(username)).toBe(1);
  });

  it('frees the slot once the request is older than the window', async () => {
    getDb()
      .prepare("UPDATE device_change_requests SET requested_at = datetime('now', '-31 days') WHERE field_executive_id = ?")
      .run(fieldExecutiveIdFor(username));

    const overview = await getOverview(username);
    expect(overview.eligibility).toMatchObject({ canRequest: true, requestsInWindow: 0, nextRequestAllowedAt: null });
  });

  it('applies a changed window length immediately', async () => {
    await updateSettings([{ key: 'device_change_window_days', value: 60 }]);

    const overview = await getOverview(username);
    expect(overview.eligibility).toMatchObject({ blockedReason: 'limit_reached', requestsInWindow: 1 });
  });
});

describe('history for the back office', () => {
  it('adds device history and requests to Field Executive History', async () => {
    const response = await request(app)
      .get(`/api/v1/admin/field-executives/${fieldExecutiveIdFor('fe014')}/history`)
      .set('Cookie', await adminCookie());

    expect(response.status).toBe(200);
    expect(response.body.data.deviceHistory).toHaveLength(2);
    expect(response.body.data.deviceChangeRequests).toHaveLength(1);
    expect(response.body.data.deviceChangeRequests[0]).toMatchObject({
      status: 'approved',
      newDevice: { deviceId: 'approve-phone-b' },
      decidedBy: { id: SEEDED_ADMIN.id },
    });
  });

  it('refuses to delete an admin who decided a device change request', async () => {
    const superAdmin = await adminCookie();
    const created = await request(app)
      .post('/api/v1/admin/admin-users')
      .set('Cookie', superAdmin)
      .send({ name: 'Device Reviewer', email: 'device.reviewer@fullscan.test', role: 'admin' });
    expect(created.status).toBe(201);

    const reviewer = await adminCookie({
      username: 'device.reviewer@fullscan.test',
      password: created.body.data.temporaryPassword,
    });
    const requestId = await bindAndRequest('fe017', handset('reviewer-phone', 'Reviewer Phone'));
    expect((await decide(requestId, 'reject', undefined, reviewer)).status).toBe(200);

    const deletion = await request(app)
      .delete(`/api/v1/admin/admin-users/${created.body.data.adminUser.id}`)
      .set('Cookie', superAdmin);

    expect(deletion.status).toBe(409);
    expect(deletion.body.error).toContain('device change request');
    expect(countRequestRows('fe017')).toBe(1);
  });
});
