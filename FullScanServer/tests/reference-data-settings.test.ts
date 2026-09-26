import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, extractSessionCookie, removeTestDb, SEEDED_ADMIN } from './helpers/test-app.js';

/**
 * Mobile app settings are delivered to the app on the existing post-login
 * reference-data call rather than a dedicated endpoint. These tests cover that
 * contract and the admin-edit → app-payload round trip.
 */

const REFERENCE_DATA = '/api/v1/reference-data';
const ADMIN_SETTINGS = '/api/v1/admin/mobile-app-settings';

let cookie: string;

beforeAll(async () => {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

  cookie = extractSessionCookie(response.headers['set-cookie']);
});

afterAll(async () => {
  await removeTestDb();
});

describe(`GET ${REFERENCE_DATA}`, () => {
  it('still returns every dropdown list it did before', async () => {
    const response = await request(app).get(REFERENCE_DATA);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data)).toEqual(
      expect.arrayContaining([
        'verificationTypeStatuses',
        'utvOptions',
        'insuffOptions',
        'photoTypes',
        'componentStatuses',
        'actionStatuses',
        'profileStatuses',
      ]),
    );
  });

  it('carries every seeded mobile app setting', async () => {
    const response = await request(app).get(REFERENCE_DATA);
    const { values } = response.body.data.mobileAppSettings;

    const adminView = await request(app).get(ADMIN_SETTINGS).set('Cookie', cookie);
    expect(Object.keys(values).length).toBe(adminView.body.data.length);
  });

  it('delivers each value in its declared type, not as text', async () => {
    const response = await request(app).get(REFERENCE_DATA);
    const { values } = response.body.data.mobileAppSettings;

    expect(values.geo_fence_radius_meters).toBeTypeOf('number');
    expect(values.watermark_enabled).toBeTypeOf('boolean');
    expect(values.default_language).toBeTypeOf('string');
    expect(values.watermark_enabled).toBe(true);
    expect(values.force_update_enabled).toBe(false);
  });

  it('carries locationRetryCount under its camelCase contract key', async () => {
    const response = await request(app).get(REFERENCE_DATA);
    const { values } = response.body.data.mobileAppSettings;

    expect(values).toHaveProperty('locationRetryCount');
    expect(values.locationRetryCount).toBe(3);
    expect(values.locationRetryCount).toBeTypeOf('number');
    expect(values).not.toHaveProperty('location_retry_count');
  });

  it('omits the portal-only presentation metadata', async () => {
    const response = await request(app).get(REFERENCE_DATA);
    const { mobileAppSettings } = response.body.data;

    // Labels/descriptions are admin-facing English; the app localizes its own text.
    expect(Object.keys(mobileAppSettings).sort()).toEqual(['updatedAt', 'values']);
    expect(JSON.stringify(mobileAppSettings)).not.toContain('Geo-fence radius');
  });

  it('reports the most recent change across all settings as updatedAt', async () => {
    await request(app)
      .put(ADMIN_SETTINGS)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'max_photo_upload_size_mb', value: 7 }] });

    const response = await request(app).get(REFERENCE_DATA);
    const { mobileAppSettings } = response.body.data;

    const adminView = await request(app).get(ADMIN_SETTINGS).set('Cookie', cookie);
    const latest = adminView.body.data
      .map((setting: { updatedAt: string | null }) => setting.updatedAt)
      .filter(Boolean)
      .sort()
      .pop();

    expect(mobileAppSettings.updatedAt).toBe(latest);
  });
});

describe('admin edit → mobile payload round trip', () => {
  it('serves an admin-saved value on the next reference-data fetch', async () => {
    const before = await request(app).get(REFERENCE_DATA);
    expect(before.body.data.mobileAppSettings.values.geo_fence_radius_meters).not.toBe(425);

    await request(app)
      .put(ADMIN_SETTINGS)
      .set('Cookie', cookie)
      .send({
        settings: [
          { key: 'geo_fence_radius_meters', value: 425 },
          { key: 'watermark_enabled', value: false },
          { key: 'default_language', value: 'hi' },
        ],
      });

    const after = await request(app).get(REFERENCE_DATA);
    const { values } = after.body.data.mobileAppSettings;

    expect(values.geo_fence_radius_meters).toBe(425);
    expect(values.watermark_enabled).toBe(false);
    expect(values.default_language).toBe('hi');
  });

  it('serves an admin-saved locationRetryCount to the app', async () => {
    await request(app)
      .put(ADMIN_SETTINGS)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'locationRetryCount', value: 6 }] });

    const response = await request(app).get(REFERENCE_DATA);

    expect(response.body.data.mobileAppSettings.values.locationRetryCount).toBe(6);
  });

  it('does not serve a rejected edit', async () => {
    const rejected = await request(app)
      .put(ADMIN_SETTINGS)
      .set('Cookie', cookie)
      .send({ settings: [{ key: 'photo_compression_quality', value: 500 }] });

    expect(rejected.status).toBe(400);

    const response = await request(app).get(REFERENCE_DATA);
    expect(response.body.data.mobileAppSettings.values.photo_compression_quality).not.toBe(500);
  });
});
