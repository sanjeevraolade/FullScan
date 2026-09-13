import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  app,
  extractSessionCookie,
  getDb,
  removeTestDb,
  SEEDED_FIELD_EXECUTIVE,
} from './helpers/test-app.js';

const HANDSET = {
  deviceId: 'e2eda104bcacf53b',
  deviceDetails: {
    deviceName: 'Galaxy S25',
    model: 'SM-S931B',
    brand: 'samsung',
    osVersion: '16',
    appVersion: '1.0',
    systemName: 'Android',
    uniqueId: 'e2eda104bcacf53b',
  },
};

afterAll(() => {
  removeTestDb();
});

beforeEach(() => {
  setDeviceBinding(null, null);
});

function setDeviceBinding(deviceId: string | null, deviceDetails: string | null): void {
  getDb()
    .prepare('UPDATE field_executives SET device_id = ?, device_details = ? WHERE id = ?')
    .run(deviceId, deviceDetails, SEEDED_FIELD_EXECUTIVE.id);
}

async function signIn(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

async function fetchProfile() {
  const response = await request(app).get('/api/v1/fe-web/profile').set('Cookie', await signIn());
  expect(response.status).toBe(200);
  return response.body.data;
}

describe('GET /api/v1/fe-web/profile', () => {
  it('requires a web session', async () => {
    expect((await request(app).get('/api/v1/fe-web/profile')).status).toBe(401);
  });

  it('rejects a mobile token in the session cookie', async () => {
    const mobileToken = jwt.sign({ fieldExecutiveId: SEEDED_FIELD_EXECUTIVE.id }, 'test-jwt-secret', {
      expiresIn: '1h',
    });

    const response = await request(app)
      .get('/api/v1/fe-web/profile')
      .set('Cookie', `fs_fe_session=${mobileToken}`);

    expect(response.status).toBe(401);
  });

  it('returns the profile with no mobile device when the FE has not signed in to the app', async () => {
    const profile = await fetchProfile();

    expect(profile.fieldExecutive).toMatchObject({ id: SEEDED_FIELD_EXECUTIVE.id });
    expect(profile.mobileDevice).toBeNull();
  });

  it('shows the handset recorded by a real mobile app login', async () => {
    const mobileLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: SEEDED_FIELD_EXECUTIVE.username,
        password: SEEDED_FIELD_EXECUTIVE.password,
        ...HANDSET,
      });
    expect(mobileLogin.status).toBe(200);

    const profile = await fetchProfile();

    expect(profile.mobileDevice).toEqual({
      deviceId: 'e2eda104bcacf53b',
      deviceName: 'Galaxy S25',
      brand: 'samsung',
      model: 'SM-S931B',
      systemName: 'Android',
      osVersion: '16',
      appVersion: '1.0',
    });
  });

  it('only exposes the known device fields, never extra keys the app stored', async () => {
    setDeviceBinding(
      'device-with-extras',
      JSON.stringify({ ...HANDSET.deviceDetails, carrier: 'Jio', ipAddress: '10.0.0.7' }),
    );

    const profile = await fetchProfile();

    expect(Object.keys(profile.mobileDevice).sort()).toEqual(
      ['appVersion', 'brand', 'deviceId', 'deviceName', 'model', 'osVersion', 'systemName'].sort(),
    );
    expect(JSON.stringify(profile)).not.toContain('10.0.0.7');
  });

  it('still shows the binding when the stored details are unreadable', async () => {
    setDeviceBinding('device-with-bad-json', '{not json');

    const profile = await fetchProfile();

    expect(profile.mobileDevice).toEqual({
      deviceId: 'device-with-bad-json',
      deviceName: null,
      brand: null,
      model: null,
      systemName: null,
      osVersion: null,
      appVersion: null,
    });
  });

  it('treats blank or non-string detail values as missing', async () => {
    setDeviceBinding('device-with-odd-values', JSON.stringify({ deviceName: '   ', model: 42, brand: null }));

    const { mobileDevice } = await fetchProfile();

    expect(mobileDevice.deviceName).toBeNull();
    expect(mobileDevice.model).toBeNull();
    expect(mobileDevice.brand).toBeNull();
  });

  it('never returns the password hash or raw device_details', async () => {
    setDeviceBinding(HANDSET.deviceId, JSON.stringify(HANDSET.deviceDetails));

    const body = JSON.stringify(await fetchProfile());

    expect(body).not.toContain('password_hash');
    expect(body).not.toContain('device_details');
    expect(body).not.toContain('uniqueId');
  });
});
