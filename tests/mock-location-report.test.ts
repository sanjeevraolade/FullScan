import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, getDb, removeTestDb } from './helpers/test-app.js';

/**
 * POST /api/v1/security/mock-location — the mobile app reports a faked device
 * location as soon as it detects one (right after login, on resume, on a manual
 * recheck, or at capture time).
 */

const ENDPOINT = '/api/v1/security/mock-location';
const FIELD_EXECUTIVE = { username: 'fe001', password: 'Password123!', id: 'fe-001' };
const DEVICE_ID = 'test-device-fe001';

let token: string;

function buildReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientEventId: `evt-${Math.random().toString(36).slice(2)}`,
    detectionStage: 'post_login',
    detectedAt: '2026-09-05T06:30:00.000Z',
    fix: {
      latitude: 17.4452,
      longitude: 78.3821,
      accuracyMeters: 5,
      capturedAt: '2026-09-05T06:29:58.000Z',
      source: 'fresh',
    },
    caseId: 'case-1001',
    device: {
      deviceId: DEVICE_ID,
      deviceName: 'Pixel 7',
      model: 'Pixel 7',
      brand: 'google',
      manufacturer: 'Google',
      deviceType: 'Handset',
      systemName: 'Android',
      osVersion: '14',
      appVersion: '1.4.2',
      appBuildNumber: '142',
      installerPackageName: 'com.android.vending',
      isEmulator: false,
      timeZone: 'Asia/Kolkata',
    },
    ...overrides,
  };
}

beforeAll(async () => {
  const response = await request(app).post('/api/v1/auth/login').send({
    username: FIELD_EXECUTIVE.username,
    password: FIELD_EXECUTIVE.password,
    deviceId: DEVICE_ID,
    deviceDetails: {
      deviceName: 'Pixel 7',
      model: 'Pixel 7',
      brand: 'google',
      osVersion: '14',
      appVersion: '1.4.2',
      systemName: 'Android',
      uniqueId: DEVICE_ID,
    },
  });

  token = response.body.data.token;
});

afterAll(() => {
  removeTestDb();
});

describe(`POST ${ENDPOINT}`, () => {
  it('rejects an unauthenticated report', async () => {
    const response = await request(app).post(ENDPOINT).send(buildReport());

    expect(response.status).toBe(401);
  });

  it('records a detection with every detail the device sent', async () => {
    const report = buildReport();

    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${token}`)
      .send(report);

    expect(response.status).toBe(201);
    expect(response.body.data.isDuplicate).toBe(false);
    expect(response.body.data.eventId).toBeTruthy();
    expect(response.body.data.totalEventCount).toBeGreaterThanOrEqual(1);

    const row = getDb()
      .prepare('SELECT * FROM mock_location_events WHERE id = ?')
      .get(response.body.data.eventId) as Record<string, unknown>;

    expect(row.field_executive_id).toBe(FIELD_EXECUTIVE.id);
    expect(row.detection_stage).toBe('post_login');
    expect(row.detected_at).toBe('2026-09-05T06:30:00.000Z');
    expect(row.latitude).toBeCloseTo(17.4452);
    expect(row.longitude).toBeCloseTo(78.3821);
    expect(row.accuracy_meters).toBe(5);
    expect(row.fix_source).toBe('fresh');
    expect(row.case_id).toBe('case-1001');
    expect(row.device_id).toBe(DEVICE_ID);
    expect(row.device_manufacturer).toBe('Google');
    expect(row.device_type).toBe('Handset');
    expect(row.os_name).toBe('Android');
    expect(row.os_version).toBe('14');
    expect(row.app_version).toBe('1.4.2');
    expect(row.app_build_number).toBe('142');
    expect(row.installer_package_name).toBe('com.android.vending');
    expect(row.is_emulator).toBe(0);
    expect(row.device_time_zone).toBe('Asia/Kolkata');
    // The server stamps its own clock — a tampered device clock can't hide the report time.
    expect(row.reported_at).toBeTruthy();
    expect(JSON.parse(row.raw_payload as string).clientEventId).toBe(report.clientEventId);
  });

  it('accepts a re-delivered report without creating a second row', async () => {
    const report = buildReport({ clientEventId: 'evt-retried-once' });

    const first = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${token}`)
      .send(report);
    const retry = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${token}`)
      .send(report);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.isDuplicate).toBe(true);
    expect(retry.body.data.eventId).toBe(first.body.data.eventId);

    const { total } = getDb()
      .prepare('SELECT COUNT(*) AS total FROM mock_location_events WHERE client_event_id = ?')
      .get('evt-retried-once') as { total: number };
    expect(total).toBe(1);
  });

  it('records a detection reported without a fix or a case', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientEventId: 'evt-minimal',
        detectionStage: 'app_resume',
        detectedAt: '2026-09-05T07:00:00.000Z',
      });

    expect(response.status).toBe(201);

    const row = getDb()
      .prepare('SELECT * FROM mock_location_events WHERE client_event_id = ?')
      .get('evt-minimal') as Record<string, unknown>;

    expect(row.latitude).toBeNull();
    expect(row.case_id).toBeNull();
    expect(row.is_emulator).toBe(0);
  });

  it('counts every detection against the executive and keeps the earliest one', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${token}`)
      .send(buildReport({ clientEventId: 'evt-counted', detectedAt: '2026-09-01T05:00:00.000Z' }));

    expect(response.status).toBe(201);
    expect(response.body.data.totalEventCount).toBeGreaterThanOrEqual(3);
    expect(response.body.data.firstDetectedAt).toBe('2026-09-01T05:00:00.000Z');
  });

  it('rejects a report with an unknown detection stage', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${token}`)
      .send(buildReport({ detectionStage: 'while_sleeping' }));

    expect(response.status).toBe(400);
  });

  it('rejects a report with no client event id', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', `Bearer ${token}`)
      .send(buildReport({ clientEventId: '' }));

    expect(response.status).toBe(400);
  });
});
