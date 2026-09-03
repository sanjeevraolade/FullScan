import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, extractSessionCookie, getDb, removeTestDb, SEEDED_ADMIN } from './helpers/test-app.js';

const ENDPOINT = '/api/v1/admin/mobile-app-settings';

let cookie: string;

beforeAll(async () => {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

  cookie = extractSessionCookie(response.headers['set-cookie']);
});

afterAll(() => {
  removeTestDb();
});

function findSetting(settings: Array<{ key: string }>, key: string) {
  return settings.find((setting) => setting.key === key);
}

describe('authorization', () => {
  it('refuses to read settings without a session', async () => {
    const response = await request(app).get(ENDPOINT);

    expect(response.status).toBe(401);
  });

  it('refuses to write settings without a session', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .send({ settings: [{ key: 'sync_on_wifi_only', value: true }] });

    expect(response.status).toBe(401);
  });
});

describe(`GET ${ENDPOINT}`, () => {
  it('returns the seeded settings with their render metadata', async () => {
    const response = await request(app).get(ENDPOINT).set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);

    const geoFence = findSetting(response.body.data, 'geo_fence_radius_meters');
    expect(geoFence).toMatchObject({
      valueType: 'number',
      category: 'evidence',
      minValue: 10,
      maxValue: 2000,
    });
  });

  it('exposes locationRetryCount with a 3-10 range, so the portal renders a bounded input', async () => {
    const response = await request(app).get(ENDPOINT).set('Cookie', cookie);
    const retryCount = findSetting(response.body.data, 'locationRetryCount');

    expect(retryCount).toMatchObject({
      key: 'locationRetryCount',
      value: 3,
      valueType: 'number',
      category: 'evidence',
      minValue: 3,
      maxValue: 10,
      label: 'Location retry count',
      options: null,
    });
  });

  it('coerces each stored TEXT value back to its declared type', async () => {
    const response = await request(app).get(ENDPOINT).set('Cookie', cookie);

    expect(findSetting(response.body.data, 'watermark_enabled')?.value).toBe(true);
    expect(findSetting(response.body.data, 'force_update_enabled')?.value).toBe(false);
    expect(findSetting(response.body.data, 'sync_interval_minutes')?.value).toBe(15);
    expect(findSetting(response.body.data, 'min_supported_app_version')?.value).toBe('1.0.0');
  });

  it('exposes the allowed options for an enum setting', async () => {
    const response = await request(app).get(ENDPOINT).set('Cookie', cookie);

    expect(findSetting(response.body.data, 'default_language')?.options).toEqual([
      'en',
      'hi',
      'te',
    ]);
  });
});

describe(`PUT ${ENDPOINT}`, () => {
  it('applies a batch of valid changes and returns the full updated set', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({
        settings: [
          { key: 'geo_fence_radius_meters', value: 350 },
          { key: 'sync_on_wifi_only', value: true },
          { key: 'default_language', value: 'hi' },
          { key: 'min_supported_app_version', value: '1.4.2' },
        ],
      });

    expect(response.status).toBe(200);
    expect(findSetting(response.body.data, 'geo_fence_radius_meters')?.value).toBe(350);
    expect(findSetting(response.body.data, 'sync_on_wifi_only')?.value).toBe(true);
    expect(findSetting(response.body.data, 'default_language')?.value).toBe('hi');
    expect(findSetting(response.body.data, 'min_supported_app_version')?.value).toBe('1.4.2');
  });

  it('records which admin made the change', async () => {
    await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'photo_compression_quality', value: 65 }] });

    const row = getDb()
      .prepare('SELECT updated_by, updated_at FROM mobile_app_settings WHERE setting_key = ?')
      .get('photo_compression_quality') as { updated_by: string; updated_at: string };

    expect(row.updated_by).toBe(SEEDED_ADMIN.id);
    expect(row.updated_at).toBeTruthy();
  });

  it('trims whitespace from string values', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'support_contact_number', value: '  +919812345678  ' }] });

    expect(findSetting(response.body.data, 'support_contact_number')?.value).toBe(
      '+919812345678',
    );
  });

  it('rejects a number below its minimum', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'geo_fence_radius_meters', value: 5 }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('at least 10');
  });

  it('rejects a number above its maximum', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'photo_compression_quality', value: 240 }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('at most 100');
  });

  it('rejects a value outside an enum setting’s options', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'default_language', value: 'fr' }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('en, hi, te');
  });

  it('rejects a non-boolean for a boolean setting', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'watermark_enabled', value: 'yes please' }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('true or false');
  });

  it('accepts locationRetryCount at both ends of its range', async () => {
    for (const value of [3, 10]) {
      const response = await request(app)
        .put(ENDPOINT)
        .set('Cookie', cookie)
        .send({ settings: [{ key: 'locationRetryCount', value }] });

      expect(response.status).toBe(200);
      expect(findSetting(response.body.data, 'locationRetryCount')?.value).toBe(value);
    }
  });

  it('rejects locationRetryCount below 3', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'locationRetryCount', value: 2 }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('"Location retry count" must be at least 3');
  });

  it('rejects locationRetryCount above 10', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'locationRetryCount', value: 11 }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('"Location retry count" must be at most 10');
  });

  it('accepts the geo-fence radius at both ends of its tightened range', async () => {
    for (const value of [10, 2000]) {
      const response = await request(app)
        .put(ENDPOINT)
        .set('Cookie', cookie)
        .send({ settings: [{ key: 'geo_fence_radius_meters', value }] });

      expect(response.status).toBe(200);
      expect(findSetting(response.body.data, 'geo_fence_radius_meters')?.value).toBe(value);
    }
  });

  it('rejects a geo-fence radius above the new 2000m maximum', async () => {
    // 3000 was legal under the previous 5000m bound.
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'geo_fence_radius_meters', value: 3000 }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('at most 2000');
  });

  it('rejects an unknown setting key', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'drop_table_settings', value: 'nope' }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Unknown setting');
  });

  it('rejects the same key twice in one batch', async () => {
    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({
        settings: [
          { key: 'sync_interval_minutes', value: 20 },
          { key: 'sync_interval_minutes', value: 30 },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Duplicate setting');
  });

  it('rejects an empty batch', async () => {
    const response = await request(app).put(ENDPOINT).set('Cookie', cookie).send({ settings: [] });

    expect(response.status).toBe(400);
  });

  it('writes nothing at all when one entry in the batch is invalid', async () => {
    const before = await request(app).get(ENDPOINT).set('Cookie', cookie);
    const originalInterval = findSetting(before.body.data, 'sync_interval_minutes')?.value;

    const response = await request(app)
      .put(ENDPOINT)
      .set('Cookie', cookie)
      .send({
        settings: [
          { key: 'sync_interval_minutes', value: 45 },
          { key: 'offline_queue_retry_limit', value: 9999 },
        ],
      });

    expect(response.status).toBe(400);

    const after = await request(app).get(ENDPOINT).set('Cookie', cookie);
    expect(findSetting(after.body.data, 'sync_interval_minutes')?.value).toBe(originalInterval);
  });
});
