import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, getCollection, removeTestDb, SEEDED_FIELD_EXECUTIVE } from './helpers/test-app.js';

/**
 * Mobile login (`POST /api/v1/auth/login`) returns the session token together with
 * the field executive's profile, so the app no longer needs a `GET /me` round trip
 * at login. The profile must be exactly what `/me` returns, and never carry the
 * password hash or the device binding.
 *
 * Device-binding refusals (403) are covered in `device-change.test.ts`.
 */

const LOGIN = '/api/v1/auth/login';
const ME = '/api/v1/me';

const HANDSET = {
  deviceId: 'auth-test-handset-01',
  deviceDetails: {
    deviceName: 'Pixel 8',
    model: 'Pixel 8',
    brand: 'google',
    osVersion: '15',
    appVersion: '1.0',
    systemName: 'Android',
    uniqueId: 'auth-test-handset-01',
  },
};

function login(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(LOGIN)
    .send({
      username: SEEDED_FIELD_EXECUTIVE.username,
      password: SEEDED_FIELD_EXECUTIVE.password,
      ...HANDSET,
      ...overrides,
    });
}

afterAll(async () => {
  await removeTestDb();
});

describe(`POST ${LOGIN}`, () => {
  it('returns the session token and the same profile GET /me returns for it', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Object.keys(response.body.data).sort()).toEqual(['fieldExecutive', 'token']);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.fieldExecutive.id).toBe(SEEDED_FIELD_EXECUTIVE.id);

    const me = await request(app).get(ME).set('Authorization', `Bearer ${response.body.data.token}`);

    expect(me.status).toBe(200);
    expect(response.body.data.fieldExecutive).toEqual(me.body.data);
  });

  it('never exposes the password hash or the device binding in the profile', async () => {
    // Log in twice so the second login reads an account that is already bound to this handset.
    expect((await login()).status).toBe(200);
    const bound = await getCollection('field_executives').findOne({ _id: SEEDED_FIELD_EXECUTIVE.id });
    expect(bound?.device_id).toBe(HANDSET.deviceId);
    expect(bound?.device_details).toEqual(expect.any(String));

    const response = await login();
    const { fieldExecutive } = response.body.data;

    expect(response.status).toBe(200);
    expect(fieldExecutive).not.toHaveProperty('password_hash');
    expect(fieldExecutive).not.toHaveProperty('device_id');
    expect(fieldExecutive).not.toHaveProperty('device_details');
    expect(Object.keys(fieldExecutive).sort()).toEqual(['email', 'id', 'name', 'role']);
    expect(JSON.stringify(response.body)).not.toContain(String(bound?.password_hash));
  });

  it('rejects a wrong password with 401 and neither a token nor a profile', async () => {
    const response = await login({ password: 'not-the-password' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Invalid username or password' });
    expect(response.body).not.toHaveProperty('data');
    expect(JSON.stringify(response.body)).not.toContain('token');
    expect(JSON.stringify(response.body)).not.toContain('fieldExecutive');
  });

  it('gives an unknown username the same 401 as a wrong password', async () => {
    const response = await login({ username: 'no-such-field-executive' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Invalid username or password' });
  });

  it('rejects a body without a device ID as a validation failure', async () => {
    const response = await request(app)
      .post(LOGIN)
      .send({
        username: SEEDED_FIELD_EXECUTIVE.username,
        password: SEEDED_FIELD_EXECUTIVE.password,
        deviceDetails: HANDSET.deviceDetails,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).not.toHaveProperty('data');
  });

  it('rejects a blank device ID with 400 and no token', async () => {
    const response = await login({ deviceId: '   ' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Device ID is required' });
  });
});
