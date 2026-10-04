import crypto from 'crypto';
import request from 'supertest';
import { app, SEEDED_FIELD_EXECUTIVE } from './test-app.js';

/** Helpers for suites that need a mobile capture on record (docs/api-contracts/mobile-evidence-upload.md). */

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

export const MOBILE_CAPTURE_FIELDS: Readonly<Record<string, string>> = {
  documentTypeCode: 'house_photo_1',
  latitude: '17.4935',
  longitude: '78.3129',
  accuracyMeters: '8.5',
  capturedAt: '2026-10-04T09:15:02.123Z',
  isMockLocation: 'false',
};

/** A JPEG whose bytes — and so whose SHA-256 — no other call returns. */
export function uniqueJpeg(): Buffer {
  return Buffer.concat([JPEG_HEADER, crypto.randomBytes(32)]);
}

/** Signs the seeded field executive in on the mobile API and returns the bearer token. */
export async function signInMobile(deviceId = 'mobile-capture-test-device'): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({
    username: SEEDED_FIELD_EXECUTIVE.username,
    password: SEEDED_FIELD_EXECUTIVE.password,
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
  });

  if (response.status !== 200) {
    throw new Error(`Mobile sign-in failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.token as string;
}

/** `POST /cases/:componentId/evidence` with one fresh JPEG. */
export function uploadMobileCapture(
  token: string,
  componentId: string,
  fields: Readonly<Record<string, string>> = MOBILE_CAPTURE_FIELDS,
  fileName = 'house_photo_1-1791105302123.jpg',
) {
  let pending = request(app).post(`/api/v1/cases/${componentId}/evidence`).set('Authorization', `Bearer ${token}`);

  for (const [name, value] of Object.entries(fields)) {
    pending = pending.field(name, value);
  }
  return pending.attach('file', uniqueJpeg(), fileName);
}
