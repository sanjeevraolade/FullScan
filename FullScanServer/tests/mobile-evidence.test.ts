import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Document } from 'mongodb';
import {
  app,
  extractSessionCookie,
  getCollection,
  getDb,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
  testDbDir,
} from './helpers/test-app.js';
import { applySchema, MOBILE_CAPTURE_SHA256_INDEX } from '../src/db/schema.js';
import * as caseEvidenceDao from '../src/db/case-evidence.dao.js';
import { toDisplayName } from '../src/services/case-evidence.service.js';
import { MAX_MOBILE_PHOTO_BYTES } from '../src/services/mobile-evidence.service.js';
import { DEFAULT_JSON_BODY_LIMIT_BYTES, MOBILE_EVIDENCE_JSON_BODY_LIMIT_BYTES } from '../src/middleware/json-body.js';
import { base64DecodedLength, isStrictBase64 } from '../src/utils/base64.js';
import { MOBILE_CAPTURE_METADATA, mobileCaptureBody, signInMobile, uniqueJpeg } from './helpers/mobile-capture.js';
import { VERIFIED_CLEAR_OUTCOME } from './helpers/verification-outcome.js';

/**
 * `POST /api/v1/cases/:caseId/evidence` — docs/api-contracts/mobile-evidence-upload.md.
 * One camera photo per request, base64 inside a strict JSON body (≤ 14 MB, a route-only
 * limit), idempotent by the decoded photo's SHA-256.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

const BODY_FIELDS = [
  'documentTypeCode',
  'latitude',
  'longitude',
  'accuracyMeters',
  'capturedAt',
  'isMockLocation',
  'fileName',
  'contentBase64',
] as const;

let token: string;

beforeAll(async () => {
  token = await signInMobile('mobile-evidence-test-device');
});

afterAll(async () => {
  await removeTestDb();
});

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function evidencePath(componentId: string): string {
  return `/api/v1/cases/${componentId}/evidence`;
}

/** Posts `body` as JSON with the mobile token (or `bearer`; `null` sends none). */
function upload(componentId: string, body: unknown = mobileCaptureBody(), bearer: string | null = token) {
  const pending = request(app).post(evidencePath(componentId));
  return (bearer ? pending.set('Authorization', `Bearer ${bearer}`) : pending).send(body as object);
}

/** Posts a raw string as `application/json` — for malformed JSON. */
function uploadRaw(componentId: string, raw: string) {
  return request(app)
    .post(evidencePath(componentId))
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/json')
    .send(raw);
}

/** A JPEG of exactly `size` bytes, unique by its first bytes. */
function jpegOfSize(size: number): Buffer {
  const head = uniqueJpeg();
  return Buffer.concat([head, Buffer.alloc(size - head.length)]);
}

async function findComponentId(filter: Document): Promise<string> {
  const row = await getCollection('case_components').findOne(filter, { projection: { _id: 1 } });

  if (!row) {
    throw new Error(`Seed has no component matching: ${JSON.stringify(filter)}`);
  }
  return String(row._id);
}

const ownComponent = (bucket: string): Promise<string> =>
  findComponentId({ assigned_field_executive_id: SEEDED_FIELD_EXECUTIVE.id, bucket });

function countEvidenceRows(componentId: string): Promise<number> {
  return getCollection('case_evidence').countDocuments({ component_id: componentId });
}

function listStoredFiles(componentId: string): string[] {
  const dir = path.join(testDbDir, 'uploads', 'evidence', componentId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

interface StoredState {
  readonly rows: number;
  readonly files: number;
}

async function storedState(componentId: string): Promise<StoredState> {
  return { rows: await countEvidenceRows(componentId), files: listStoredFiles(componentId).length };
}

async function expectNothingStored(componentId: string, before: StoredState): Promise<void> {
  expect(await storedState(componentId)).toEqual(before);
}

describe('POST /api/v1/cases/:caseId/evidence — success', () => {
  it('decodes the photo, stores it, records the capture metadata and answers 201 with the record', async () => {
    const componentId = await ownComponent('pending');
    const photo = uniqueJpeg();

    const response = await upload(componentId, mobileCaptureBody(photo));

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        componentId,
        source: 'mobile_capture',
        fileName: MOBILE_CAPTURE_METADATA.fileName,
        mimeType: 'image/jpeg',
        sizeBytes: photo.length,
        sha256: sha256(photo),
        documentTypeCode: 'house_photo_1',
        latitude: 17.4935,
        longitude: 78.3129,
        accuracyMeters: 8.5,
        isMockLocation: false,
        capturedAt: '2026-10-04 09:15:02',
        uploadedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
      },
    });
    expect(Object.keys(response.body.data)).toEqual([
      'id',
      'componentId',
      'source',
      'fileName',
      'mimeType',
      'sizeBytes',
      'sha256',
      'documentTypeCode',
      'latitude',
      'longitude',
      'accuracyMeters',
      'isMockLocation',
      'capturedAt',
      'uploadedAt',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('storage');

    const id = response.body.data.id as string;
    const stored = await getCollection('case_evidence').findOne({ _id: id });
    expect(stored).toMatchObject({
      component_id: componentId,
      field_executive_id: SEEDED_FIELD_EXECUTIVE.id,
      source: 'mobile_capture',
      original_name: MOBILE_CAPTURE_METADATA.fileName,
      storage_path: `evidence/${componentId}/${id}.jpg`,
      mime_type: 'image/jpeg',
      size_bytes: photo.length,
      sha256: sha256(photo),
      document_type_code: 'house_photo_1',
      latitude: 17.4935,
      longitude: 78.3129,
      accuracy_meters: 8.5,
      is_mock_location: false,
      captured_at: '2026-10-04 09:15:02',
      uploaded_at: response.body.data.uploadedAt,
    });

    // The decoded bytes are on disk — not the base64 text.
    expect(listStoredFiles(componentId)).toEqual([`${id}.jpg`]);
    expect(fs.readFileSync(path.join(testDbDir, 'uploads', 'evidence', componentId, `${id}.jpg`))).toEqual(photo);
  });

  it('accepts a Beyond TAT component, converts an offset capturedAt to UTC and sanitizes the file name', async () => {
    const componentId = await ownComponent('beyond_tat');

    const response = await upload(
      componentId,
      mobileCaptureBody(uniqueJpeg(), {
        documentTypeCode: 'id_proof',
        capturedAt: '2026-10-04T14:45:02+05:30',
        fileName: '..\\..\\etc/id\u0007proof\u007f.jpg',
      }),
    );

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({
      documentTypeCode: 'id_proof',
      capturedAt: '2026-10-04 09:15:02',
      fileName: 'idproof.jpg',
    });
  });

  it('accepts every base64 padding length and the boundary value of every number', async () => {
    const componentId = await ownComponent('pending');
    const cases: ReadonlyArray<{ readonly size: number; readonly overrides: Readonly<Record<string, unknown>> }> = [
      { size: 42, overrides: { latitude: -90, longitude: -180, accuracyMeters: 0 } },
      { size: 43, overrides: { latitude: 90, longitude: 180, accuracyMeters: 1500 } },
      { size: 44, overrides: { latitude: 1e-7, longitude: 0, accuracyMeters: 0.5 } },
    ];

    for (const { size, overrides } of cases) {
      const photo = jpegOfSize(size);
      const response = await upload(componentId, mobileCaptureBody(photo, overrides));

      expect(response.status, JSON.stringify(overrides)).toBe(201);
      expect(response.body.data).toMatchObject({ sizeBytes: size, sha256: sha256(photo), ...overrides });
    }
  });

  it('accepts and records isMockLocation = true', async () => {
    const componentId = await ownComponent('pending');

    const response = await upload(componentId, mobileCaptureBody(uniqueJpeg(), { isMockLocation: true }));

    expect(response.status).toBe(201);
    expect(response.body.data.isMockLocation).toBe(true);
    const stored = await getCollection('case_evidence').findOne({ _id: response.body.data.id as string });
    expect(stored?.is_mock_location).toBe(true);
  });

  it('keeps a display name only (shared with the web upload)', () => {
    expect(toDisplayName('../../etc/id\u0007proof\u007f.jpg')).toBe('idproof.jpg');
    expect(toDisplayName('\u0000\u001f')).toBe('evidence');
    expect(toDisplayName(`${'a'.repeat(300)}.jpg`)).toHaveLength(255);
  });
});

describe('POST /api/v1/cases/:caseId/evidence — body size (route-only 14 MB limit)', () => {
  it('accepts a 10 MB photo — a ~13.4 MB body, far over the app-wide 100 kb JSON limit', async () => {
    const componentId = await ownComponent('beyond_tat');
    const photo = jpegOfSize(MAX_MOBILE_PHOTO_BYTES);

    const response = await upload(componentId, mobileCaptureBody(photo));

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.sizeBytes).toBe(MAX_MOBILE_PHOTO_BYTES);
    expect(response.body.data.sha256).toBe(sha256(photo));
  });

  it('applies the route limit however Express matches the route (trailing slash, letter case)', async () => {
    const componentId = await ownComponent('pending');
    const photo = jpegOfSize(DEFAULT_JSON_BODY_LIMIT_BYTES * 2);

    const response = await request(app)
      .post(`/API/v1/cases/${componentId}/EVIDENCE/`)
      .set('Authorization', `Bearer ${token}`)
      .send(mobileCaptureBody(photo));

    expect(response.status, JSON.stringify(response.body)).toBe(201);
  });

  it('answers 413 when the decoded photo is over 10 MB, writing nothing', async () => {
    const componentId = await ownComponent('pending');
    const before = await storedState(componentId);
    const body = mobileCaptureBody(jpegOfSize(MAX_MOBILE_PHOTO_BYTES + 1));
    expect(JSON.stringify(body).length).toBeLessThan(MOBILE_EVIDENCE_JSON_BODY_LIMIT_BYTES);

    const response = await upload(componentId, body);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ success: false, error: 'The photo must be 10 MB or smaller' });
    await expectNothingStored(componentId, before);
  });

  it('answers 413 in the normal envelope when the body is over 14 MB', async () => {
    const componentId = await ownComponent('pending');
    const before = await storedState(componentId);
    const body = mobileCaptureBody(jpegOfSize(11 * 1024 * 1024));
    expect(JSON.stringify(body).length).toBeGreaterThan(MOBILE_EVIDENCE_JSON_BODY_LIMIT_BYTES);

    const response = await upload(componentId, body);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ success: false, error: 'Request body is too large' });
    await expectNothingStored(componentId, before);
  });

  it('keeps the app-wide 100 kb JSON limit on every other route', async () => {
    const padding = 'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES + 1);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password, padding });
    expect(login.status).toBe(413);
    expect(login.body).toEqual({ success: false, error: 'Request body is too large' });

    // A sibling route on the same router, with a valid token and an otherwise valid body.
    const outcome = await request(app)
      .post(`/api/v1/cases/${await ownComponent('pending')}/verification-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VERIFIED_CLEAR_OUTCOME, padding });
    expect(outcome.status).toBe(413);
    expect(outcome.body).toEqual({ success: false, error: 'Request body is too large' });
  });

  it('answers malformed JSON on other routes with 400 in the normal envelope, too', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": "fe001", "password": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Malformed JSON body' });
  });
});

describe('POST /api/v1/cases/:caseId/evidence — idempotency', () => {
  it('answers 200 with the existing record for the same bytes, writing nothing and ignoring the new metadata', async () => {
    const componentId = await findComponentId({
      assigned_field_executive_id: SEEDED_FIELD_EXECUTIVE.id,
      bucket: 'pending',
      _id: { $ne: await ownComponent('pending') },
    });
    const photo = uniqueJpeg();

    const first = await upload(componentId, mobileCaptureBody(photo));
    expect(first.status).toBe(201);

    const replay = await upload(
      componentId,
      mobileCaptureBody(photo, {
        documentTypeCode: 'house_photo_2',
        latitude: 1,
        isMockLocation: true,
        fileName: 'renamed.jpg',
      }),
    );

    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(await storedState(componentId)).toEqual({ rows: 1, files: 1 });
  });

  it('treats the same bytes on another component as a new capture', async () => {
    const photo = uniqueJpeg();

    expect((await upload(await ownComponent('pending'), mobileCaptureBody(photo))).status).toBe(201);
    expect((await upload(await ownComponent('beyond_tat'), mobileCaptureBody(photo))).status).toBe(201);
  });

  it('lets only one of several concurrent retries insert; the rest get the winner with 200', async () => {
    const componentId = await ownComponent('beyond_tat');
    const before = await storedState(componentId);
    const body = mobileCaptureBody(uniqueJpeg());

    const responses = await Promise.all(Array.from({ length: 5 }, () => upload(componentId, body)));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(responses.map((response) => response.body.data.id as string)).size).toBe(1);
    expect(await storedState(componentId)).toEqual({ rows: before.rows + 1, files: before.files + 1 });
  });

  it('returns the winner with 200 when the insert loses the race on the unique index, removing its own file', async () => {
    const componentId = await ownComponent('beyond_tat');
    const body = mobileCaptureBody(uniqueJpeg());

    const first = await upload(componentId, body);
    expect(first.status).toBe(201);
    const before = await storedState(componentId);

    // The lookup misses — as it does for a concurrent request that checked before the winner inserted.
    const lookup = vi.spyOn(caseEvidenceDao, 'findMobileCaptureBySha256').mockResolvedValueOnce(undefined);

    try {
      const loser = await upload(componentId, body);

      expect(loser.status, JSON.stringify(loser.body)).toBe(200);
      expect(loser.body).toEqual(first.body);
      expect(lookup).toHaveBeenCalledTimes(2);
    } finally {
      lookup.mockRestore();
    }

    await expectNothingStored(componentId, before);
  });

  it('is backed by a partial unique index the DAO reports as a duplicate', async () => {
    const photoHash = sha256(uniqueJpeg());
    const row = {
      component_id: 'dao-check',
      field_executive_id: SEEDED_FIELD_EXECUTIVE.id,
      original_name: 'x.jpg',
      mime_type: 'image/jpeg' as const,
      size_bytes: 10,
      sha256: photoHash,
      document_type_code: 'house_photo_1',
      latitude: 1,
      longitude: 2,
      accuracy_meters: 3,
      is_mock_location: false,
      captured_at: '2026-10-04 09:15:02',
    };

    await caseEvidenceDao.insertMobileCaptureRow({ ...row, id: 'dao-dup-1', storage_path: 'evidence/dao-check/dao-dup-1.jpg' });
    await expect(
      caseEvidenceDao.insertMobileCaptureRow({ ...row, id: 'dao-dup-2', storage_path: 'evidence/dao-check/dao-dup-2.jpg' }),
    ).rejects.toBeInstanceOf(caseEvidenceDao.DuplicateMobileCaptureError);

    // Web uploads are outside the partial index: the same bytes may be uploaded on the web twice.
    const web = {
      component_id: 'dao-check',
      field_executive_id: SEEDED_FIELD_EXECUTIVE.id,
      source: 'web_upload',
      original_name: 'x.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 10,
      sha256: photoHash,
      uploaded_at: '2026-10-04 09:15:02',
    };
    await expect(
      getCollection('case_evidence').insertMany([
        { ...web, _id: 'dao-web-1', storage_path: 'evidence/dao-check/dao-web-1.jpg' },
        { ...web, _id: 'dao-web-2', storage_path: 'evidence/dao-check/dao-web-2.jpg' },
      ]),
    ).resolves.toBeTruthy();
  });
});

describe('POST /api/v1/cases/:caseId/evidence — validation (400)', () => {
  let componentId: string;
  let before: StoredState;

  beforeAll(async () => {
    componentId = await ownComponent('pending');
  });

  async function snapshot(): Promise<void> {
    before = await storedState(componentId);
  }

  async function expectFieldRejected(body: unknown, field: string): Promise<void> {
    const response = await upload(componentId, body);

    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: `body.${field}` })]));
    await expectNothingStored(componentId, before);
  }

  it.each(BODY_FIELDS)('rejects a body without %s', async (field) => {
    await snapshot();
    const { [field]: _omitted, ...body } = mobileCaptureBody();

    await expectFieldRejected(body, field);
  });

  it.each<[string, unknown]>([
    ['latitude', 91],
    ['latitude', -90.0001],
    ['latitude', '17.4935'],
    ['latitude', null],
    ['longitude', 180.5],
    ['longitude', -181],
    ['longitude', '78.3129'],
    ['accuracyMeters', -0.1],
    ['accuracyMeters', '8.5'],
    ['capturedAt', '2026-10-04T09:15:02'],
    ['capturedAt', '2026-10-04 09:15:02'],
    ['capturedAt', '2026-02-30T09:15:02Z'],
    ['capturedAt', 'yesterday'],
    ['capturedAt', 1791105302123],
    ['isMockLocation', 'false'],
    ['isMockLocation', 'true'],
    ['isMockLocation', 0],
    ['isMockLocation', null],
    ['documentTypeCode', ''],
    ['documentTypeCode', 7],
    ['fileName', ''],
    ['fileName', `${'a'.repeat(252)}.jpg`],
    ['fileName', 42],
    ['contentBase64', 12345],
  ])('rejects %s = %j', async (field, value) => {
    await snapshot();

    await expectFieldRejected(mobileCaptureBody(uniqueJpeg(), { [field]: value }), field);
  });

  it.each<[string, (base64: string) => string]>([
    ['length not a multiple of 4', (base64) => base64.slice(0, -1)],
    ['a character outside the alphabet', (base64) => `${base64.slice(0, 4)}$${base64.slice(5)}`],
    ['the URL-safe alphabet', (base64) => `-_${base64.slice(2)}`],
    ['padding in the middle', (base64) => `QQ==${base64}`],
    ['too much padding', () => 'QUJDQ==='],
    ['a data: URL prefix', (base64) => `data:image/jpeg;base64,${base64}`],
    ['a line break', (base64) => `${base64.slice(0, 20)}\n${base64.slice(20, -1)}`],
    ['leading whitespace', (base64) => ` ${base64.slice(0, -1)}`],
    ['trailing whitespace', (base64) => `${base64.slice(0, -1)} `],
  ])('rejects contentBase64 with %s, before decoding it', async (_label, mutate) => {
    await snapshot();
    const contentBase64 = mutate(uniqueJpeg().toString('base64'));
    // Node would have decoded it without complaint.
    expect(Buffer.from(contentBase64, 'base64').length).toBeGreaterThan(0);

    const response = await upload(componentId, mobileCaptureBody(uniqueJpeg(), { contentBase64 }));

    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(response.body.details).toEqual([
      {
        path: 'body.contentBase64',
        message:
          'contentBase64 must be standard base64 (A-Z a-z 0-9 + /, = padding, length a multiple of 4) with no data: prefix or whitespace',
      },
    ]);
    await expectNothingStored(componentId, before);
  });

  it('rejects an empty contentBase64', async () => {
    await snapshot();

    const response = await upload(componentId, mobileCaptureBody(uniqueJpeg(), { contentBase64: '' }));

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([{ path: 'body.contentBase64', message: 'contentBase64 must not be empty' }]);
    await expectNothingStored(componentId, before);
  });

  it('never echoes the submitted base64 in an error', async () => {
    const marker = 'NeverEchoThisBase64Payload';
    const invalid = `${marker}$${uniqueJpeg().toString('base64')}`;

    const rejected = await upload(componentId, mobileCaptureBody(uniqueJpeg(), { contentBase64: invalid }));
    expect(rejected.status).toBe(400);
    expect(JSON.stringify(rejected.body)).not.toContain(marker);

    const malformed = await uploadRaw(componentId, `{"contentBase64": "${marker}`);
    expect(malformed.status).toBe(400);
    expect(JSON.stringify(malformed.body)).not.toContain(marker);
  });

  it('rejects a documentTypeCode that is not a photo_type code', async () => {
    await snapshot();

    const response = await upload(componentId, mobileCaptureBody(uniqueJpeg(), { documentTypeCode: 'selfie' }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Unknown documentTypeCode' });
    await expectNothingStored(componentId, before);
  });

  it('rejects an unknown extra field', async () => {
    await snapshot();

    const response = await upload(componentId, mobileCaptureBody(uniqueJpeg(), { caseId: componentId }));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(JSON.stringify(response.body.details)).toContain('caseId');
    await expectNothingStored(componentId, before);
  });

  it('rejects a body that is not a JSON object', async () => {
    await snapshot();

    const response = await upload(componentId, [mobileCaptureBody()]);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    await expectNothingStored(componentId, before);
  });

  it('answers malformed JSON with 400 in the normal envelope', async () => {
    await snapshot();

    const response = await uploadRaw(componentId, '{"documentTypeCode": "house_photo_1",');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Malformed JSON body' });
    await expectNothingStored(componentId, before);
  });
});

describe('POST /api/v1/cases/:caseId/evidence — auth (401)', () => {
  it('requires a mobile token', async () => {
    const componentId = await ownComponent('pending');
    const before = await storedState(componentId);

    const response = await upload(componentId, mobileCaptureBody(), null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Missing authentication token' });
    await expectNothingStored(componentId, before);
  });

  it('refuses an FE web session, as a cookie or as a bearer token', async () => {
    const componentId = await ownComponent('pending');
    const before = await storedState(componentId);
    const login = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });
    const cookie = extractSessionCookie(login.headers['set-cookie'], 'fs_fe_session');

    const withCookie = await request(app).post(evidencePath(componentId)).set('Cookie', cookie).send(mobileCaptureBody());
    expect(withCookie.status).toBe(401);

    const withWebToken = await upload(componentId, mobileCaptureBody(), cookie.slice('fs_fe_session='.length));
    expect(withWebToken.status).toBe(401);
    expect(withWebToken.body).toEqual({ success: false, error: 'Invalid or expired authentication token' });

    await expectNothingStored(componentId, before);
  });

  it('refuses an admin session', async () => {
    const componentId = await ownComponent('pending');
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    const response = await request(app)
      .post(evidencePath(componentId))
      .set('Cookie', extractSessionCookie(login.headers['set-cookie']))
      .send(mobileCaptureBody());

    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/cases/:caseId/evidence — not found (404) and closed (409)', () => {
  it('answers 404 for an unknown component', async () => {
    const response = await upload('no-such-component');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: 'Case not found' });
    expect(listStoredFiles('no-such-component')).toHaveLength(0);
  });

  it('answers the same 404 for another executive’s component, writing nothing', async () => {
    const componentId = await findComponentId({
      assigned_field_executive_id: { $nin: [SEEDED_FIELD_EXECUTIVE.id, null] },
      bucket: 'pending',
    });

    const response = await upload(componentId);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: 'Case not found' });
    await expectNothingStored(componentId, { rows: 0, files: 0 });
  });

  it('answers 409 for a New component (not accepted yet)', async () => {
    const componentId = await ownComponent('new');

    const response = await upload(componentId);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ success: false, error: 'Accept the case before adding evidence' });
    await expectNothingStored(componentId, { rows: 0, files: 0 });
  });

  it('answers 409 for a Completed component', async () => {
    const componentId = await ownComponent('completed');

    const response = await upload(componentId);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ success: false, error: 'Evidence can no longer be added to a completed case' });
    await expectNothingStored(componentId, { rows: 0, files: 0 });
  });
});

describe('POST /api/v1/cases/:caseId/evidence — 415', () => {
  it('answers 415 for a multipart body', async () => {
    const response = await request(app)
      .post(evidencePath(await ownComponent('pending')))
      .set('Authorization', `Bearer ${token}`)
      .field('documentTypeCode', 'house_photo_1')
      .attach('file', uniqueJpeg(), 'photo.jpg');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ success: false, error: 'Send the photo as application/json' });
  });

  it('answers 415 for a text body and for no body at all', async () => {
    const componentId = await ownComponent('pending');

    const text = await request(app)
      .post(evidencePath(componentId))
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(mobileCaptureBody()));
    expect(text.status).toBe(415);
    expect(text.body).toEqual({ success: false, error: 'Send the photo as application/json' });

    const empty = await request(app).post(evidencePath(componentId)).set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(415);
  });

  it('answers 415 when the decoded bytes are not a JPEG, writing nothing', async () => {
    const componentId = await ownComponent('pending');
    const before = await storedState(componentId);

    const png = await upload(componentId, mobileCaptureBody(PNG));
    expect(png.status).toBe(415);
    expect(png.body).toEqual({ success: false, error: 'The photo must be a JPEG image' });

    const script = await upload(componentId, mobileCaptureBody(Buffer.from('<script>alert(1)</script>')));
    expect(script.status).toBe(415);

    // The base64 *text* of a JPEG is not a JPEG: the type check is on the decoded bytes.
    const doubleEncoded = await upload(
      componentId,
      mobileCaptureBody(Buffer.from(uniqueJpeg().toString('base64'), 'utf8')),
    );
    expect(doubleEncoded.status).toBe(415);

    await expectNothingStored(componentId, before);
  });
});

describe('strict base64 helpers', () => {
  it('accepts canonical base64 of every padding length and reports its decoded size', () => {
    for (const size of [1, 2, 3, 4, 5, 6]) {
      const encoded = crypto.randomBytes(size).toString('base64');
      expect(isStrictBase64(encoded), encoded).toBe(true);
      expect(base64DecodedLength(encoded)).toBe(size);
    }
  });

  it('rejects empty input', () => {
    expect(isStrictBase64('')).toBe(false);
  });
});

describe('case_evidence schema', () => {
  const MOBILE_DOCUMENT = {
    component_id: 'schema-check',
    field_executive_id: SEEDED_FIELD_EXECUTIVE.id,
    source: 'mobile_capture',
    original_name: 'x.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 10,
    sha256: 'abc',
    uploaded_at: '2026-10-04 09:20:11',
    document_type_code: 'house_photo_1',
    latitude: 17,
    longitude: 78.5,
    accuracy_meters: 0,
    is_mock_location: false,
    captured_at: '2026-10-04 09:15:02',
  };

  const CAPTURE_FIELDS = [
    'document_type_code',
    'latitude',
    'longitude',
    'accuracy_meters',
    'is_mock_location',
    'captured_at',
  ] as const;

  let sequence = 0;

  function insert(document: Document) {
    sequence += 1;
    return getCollection('case_evidence').insertOne({
      ...document,
      _id: `schema-${sequence}`,
      storage_path: `evidence/schema-check/schema-${sequence}.jpg`,
    });
  }

  function without(document: Document, field: string): Document {
    const { [field]: _removed, ...rest } = document;
    return rest;
  }

  it('requires every capture field on a mobile capture, and a JPEG', async () => {
    await expect(insert(MOBILE_DOCUMENT)).resolves.toBeTruthy();

    for (const field of CAPTURE_FIELDS) {
      await expect(insert({ ...without(MOBILE_DOCUMENT, field), sha256: `missing-${field}` }), field).rejects.toThrow(
        /validation/i,
      );
      await expect(insert({ ...MOBILE_DOCUMENT, [field]: null, sha256: `null-${field}` }), field).rejects.toThrow(
        /validation/i,
      );
    }

    await expect(insert({ ...MOBILE_DOCUMENT, sha256: 'png', mime_type: 'image/png' })).rejects.toThrow(/validation/i);
    await expect(insert({ ...MOBILE_DOCUMENT, sha256: 'lat', latitude: 91 })).rejects.toThrow(/validation/i);
    await expect(insert({ ...MOBILE_DOCUMENT, sha256: 'acc', accuracy_meters: -1 })).rejects.toThrow(/validation/i);
  });

  it('allows a web upload without capture fields (or with nulls), but not with values', async () => {
    let web: Document = { ...MOBILE_DOCUMENT, source: 'web_upload', mime_type: 'image/png' };
    for (const field of CAPTURE_FIELDS) {
      web = without(web, field);
    }

    await expect(insert(web)).resolves.toBeTruthy();
    await expect(insert({ ...web, latitude: null, captured_at: null })).resolves.toBeTruthy();
    await expect(insert({ ...web, latitude: 17 })).rejects.toThrow(/validation/i);
    await expect(insert({ ...web, source: 'camera' })).rejects.toThrow(/validation/i);
  });

  it('reaches an existing database on startup: applySchema widens the validator and adds the index', async () => {
    const collection = getCollection('case_evidence');

    // What a deployment from before this change has: web uploads only, no capture index.
    await getDb().command({
      collMod: 'case_evidence',
      validator: { $jsonSchema: { bsonType: 'object', properties: { source: { enum: ['web_upload'] } } } },
    });
    await collection.dropIndex(MOBILE_CAPTURE_SHA256_INDEX);
    await expect(insert({ ...MOBILE_DOCUMENT, sha256: 'before-upgrade' })).rejects.toThrow(/validation/i);

    await applySchema(getDb());

    const indexes = await collection.indexes();
    expect(indexes.find((index) => index.name === MOBILE_CAPTURE_SHA256_INDEX)).toMatchObject({
      key: { component_id: 1, sha256: 1 },
      unique: true,
      partialFilterExpression: { source: 'mobile_capture' },
    });
    await expect(insert({ ...MOBILE_DOCUMENT, sha256: 'after-upgrade' })).resolves.toBeTruthy();
    await expect(insert({ ...MOBILE_DOCUMENT, sha256: 'after-upgrade' })).rejects.toThrow(/duplicate key/i);
  });
});
