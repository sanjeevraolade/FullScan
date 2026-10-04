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
import { MAX_EVIDENCE_FILE_BYTES, MAX_MOBILE_EVIDENCE_FIELDS } from '../src/middleware/evidence-upload.js';
import { applySchema, MOBILE_CAPTURE_SHA256_INDEX } from '../src/db/schema.js';
import * as caseEvidenceDao from '../src/db/case-evidence.dao.js';
import { toDisplayName } from '../src/services/case-evidence.service.js';
import { MOBILE_CAPTURE_FIELDS, signInMobile, uniqueJpeg } from './helpers/mobile-capture.js';

/**
 * `POST /api/v1/cases/:caseId/evidence` — docs/api-contracts/mobile-evidence-upload.md.
 * One camera photo per request, multipart `file` + six text parts, idempotent by the
 * photo's SHA-256.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

const VALID_FIELDS = MOBILE_CAPTURE_FIELDS;

const FILE_NAME = 'house_photo_1-1791105302123.jpg';

const MOBILE_FIELDS = [
  'documentTypeCode',
  'latitude',
  'longitude',
  'accuracyMeters',
  'isMockLocation',
  'capturedAt',
] as const;

interface UploadOptions {
  readonly fields?: Readonly<Record<string, string>>;
  readonly file?: Buffer | null;
  readonly fileName?: string;
  readonly bearer?: string | null;
}

let token: string;

afterAll(async () => {
  await removeTestDb();
});

beforeAll(async () => {
  token = await signInMobile('mobile-evidence-test-device');
});

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function upload(componentId: string, options: UploadOptions = {}) {
  const { fields = VALID_FIELDS, file = uniqueJpeg(), fileName = FILE_NAME, bearer = token } = options;
  let pending = request(app).post(`/api/v1/cases/${componentId}/evidence`);

  if (bearer) {
    pending = pending.set('Authorization', `Bearer ${bearer}`);
  }
  for (const [name, value] of Object.entries(fields)) {
    pending = pending.field(name, value);
  }
  if (file) {
    pending = pending.attach('file', file, fileName);
  }
  return pending;
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

async function expectNothingStored(componentId: string, rowsBefore: number, filesBefore: number): Promise<void> {
  expect(await countEvidenceRows(componentId)).toBe(rowsBefore);
  expect(listStoredFiles(componentId)).toHaveLength(filesBefore);
}

describe('POST /api/v1/cases/:caseId/evidence — success', () => {
  it('stores the photo, records the capture metadata and answers 201 with the record', async () => {
    const componentId = await ownComponent('pending');
    const photo = uniqueJpeg();

    const response = await upload(componentId, { file: photo });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        componentId,
        source: 'mobile_capture',
        fileName: FILE_NAME,
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
      original_name: FILE_NAME,
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

    expect(listStoredFiles(componentId)).toEqual([`${id}.jpg`]);
    expect(fs.readFileSync(path.join(testDbDir, 'uploads', 'evidence', componentId, `${id}.jpg`))).toEqual(photo);
  });

  it('accepts a Beyond TAT component, converts an offset capturedAt to UTC and sanitizes the file name', async () => {
    const componentId = await ownComponent('beyond_tat');

    const response = await upload(componentId, {
      fields: { ...VALID_FIELDS, documentTypeCode: 'id_proof', capturedAt: '2026-10-04T14:45:02+05:30' },
      fileName: '..\\..\\etc\\id-proof.jpg',
    });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data).toMatchObject({
      documentTypeCode: 'id_proof',
      capturedAt: '2026-10-04 09:15:02',
      fileName: 'id-proof.jpg',
    });
  });

  it('keeps a display name only (shared with the web upload)', () => {
    expect(toDisplayName('../../etc/id\u0007proof\u007f.jpg')).toBe('idproof.jpg');
    expect(toDisplayName('\u0000\u001f')).toBe('evidence');
    expect(toDisplayName(`${'a'.repeat(300)}.jpg`)).toHaveLength(255);
  });

  it('accepts the boundary values of every number', async () => {
    const componentId = await ownComponent('pending');
    const cases: ReadonlyArray<Readonly<Record<string, string>>> = [
      { latitude: '-90', longitude: '-180', accuracyMeters: '0' },
      { latitude: '90', longitude: '180', accuracyMeters: '1500' },
      { latitude: '1e-7', longitude: '+78.3', accuracyMeters: '.5' },
    ];

    for (const overrides of cases) {
      const response = await upload(componentId, { fields: { ...VALID_FIELDS, ...overrides } });
      expect(response.status, JSON.stringify(overrides)).toBe(201);
      expect(response.body.data.latitude).toBe(Number(overrides.latitude));
      expect(response.body.data.longitude).toBe(Number(overrides.longitude));
      expect(response.body.data.accuracyMeters).toBe(Number(overrides.accuracyMeters));
    }
  });

  it('accepts and records isMockLocation = true', async () => {
    const componentId = await ownComponent('pending');

    const response = await upload(componentId, { fields: { ...VALID_FIELDS, isMockLocation: 'true' } });

    expect(response.status).toBe(201);
    expect(response.body.data.isMockLocation).toBe(true);
    const stored = await getCollection('case_evidence').findOne({ _id: response.body.data.id as string });
    expect(stored?.is_mock_location).toBe(true);
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

    const first = await upload(componentId, { file: photo });
    expect(first.status).toBe(201);

    const replay = await upload(componentId, {
      file: photo,
      fields: { ...VALID_FIELDS, documentTypeCode: 'house_photo_2', latitude: '1', isMockLocation: 'true' },
      fileName: 'renamed.jpg',
    });

    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(await countEvidenceRows(componentId)).toBe(1);
    expect(listStoredFiles(componentId)).toHaveLength(1);
  });

  it('treats the same bytes on another component as a new capture', async () => {
    const photo = uniqueJpeg();
    const pending = await ownComponent('pending');
    const beyondTat = await ownComponent('beyond_tat');

    expect((await upload(pending, { file: photo })).status).toBe(201);
    expect((await upload(beyondTat, { file: photo })).status).toBe(201);
  });

  it('lets only one of several concurrent retries insert; the rest get the winner with 200', async () => {
    const componentId = await ownComponent('beyond_tat');
    const rowsBefore = await countEvidenceRows(componentId);
    const filesBefore = listStoredFiles(componentId).length;
    const photo = uniqueJpeg();

    const responses = await Promise.all(Array.from({ length: 5 }, () => upload(componentId, { file: photo })));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(responses.map((response) => response.body.data.id as string)).size).toBe(1);
    expect(await countEvidenceRows(componentId)).toBe(rowsBefore + 1);
    expect(listStoredFiles(componentId)).toHaveLength(filesBefore + 1);
  });

  it('returns the winner with 200 when the insert loses the race on the unique index, removing its own file', async () => {
    const componentId = await ownComponent('beyond_tat');
    const photo = uniqueJpeg();

    const first = await upload(componentId, { file: photo });
    expect(first.status).toBe(201);
    const rowsBefore = await countEvidenceRows(componentId);
    const filesBefore = listStoredFiles(componentId).length;

    // The lookup misses — as it does for a concurrent request that checked before the winner inserted.
    const lookup = vi.spyOn(caseEvidenceDao, 'findMobileCaptureBySha256').mockResolvedValueOnce(undefined);

    try {
      const loser = await upload(componentId, { file: photo });

      expect(loser.status, JSON.stringify(loser.body)).toBe(200);
      expect(loser.body).toEqual(first.body);
      expect(lookup).toHaveBeenCalledTimes(2);
    } finally {
      lookup.mockRestore();
    }

    expect(await countEvidenceRows(componentId)).toBe(rowsBefore);
    expect(listStoredFiles(componentId)).toHaveLength(filesBefore);
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
  let rowsBefore: number;
  let filesBefore: number;

  beforeAll(async () => {
    componentId = await ownComponent('pending');
  });

  async function snapshot(): Promise<void> {
    rowsBefore = await countEvidenceRows(componentId);
    filesBefore = listStoredFiles(componentId).length;
  }

  it.each(MOBILE_FIELDS)('rejects a request without %s', async (field) => {
    await snapshot();
    const { [field]: _omitted, ...fields } = VALID_FIELDS;

    const response = await upload(componentId, { fields });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: `body.${field}` })]));
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it.each([
    ['latitude', '91'],
    ['latitude', '-90.0001'],
    ['latitude', 'abc'],
    ['latitude', ''],
    ['latitude', ' 17.5'],
    ['latitude', '0x10'],
    ['latitude', '17,49'],
    ['longitude', '180.5'],
    ['longitude', '-181'],
    ['longitude', 'NaN'],
    ['accuracyMeters', '-0.1'],
    ['accuracyMeters', 'Infinity'],
    ['accuracyMeters', '1e999'],
    ['capturedAt', '2026-10-04T09:15:02'],
    ['capturedAt', '2026-10-04 09:15:02'],
    ['capturedAt', '2026-02-30T09:15:02Z'],
    ['capturedAt', 'yesterday'],
    ['isMockLocation', 'yes'],
    ['isMockLocation', 'TRUE'],
    ['isMockLocation', '1'],
    ['documentTypeCode', ''],
  ])('rejects %s = %j', async (field, value) => {
    await snapshot();

    const response = await upload(componentId, { fields: { ...VALID_FIELDS, [field]: value } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: `body.${field}` })]));
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('rejects a documentTypeCode that is not a photo_type code', async () => {
    await snapshot();

    const response = await upload(componentId, { fields: { ...VALID_FIELDS, documentTypeCode: 'selfie' } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Unknown documentTypeCode' });
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('rejects an unknown extra part', async () => {
    await snapshot();

    const response = await upload(componentId, { fields: { ...VALID_FIELDS, caseId: componentId } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(JSON.stringify(response.body.details)).toContain('caseId');
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('rejects a text part sent twice', async () => {
    await snapshot();

    const response = await upload(componentId).field('latitude', '18');

    expect(response.status).toBe(400);
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('rejects more text parts than the bounded limit', async () => {
    await snapshot();
    const extra = Object.fromEntries(
      Array.from({ length: MAX_MOBILE_EVIDENCE_FIELDS }, (_, index) => [`extra${index}`, 'x']),
    );

    const response = await upload(componentId, { fields: { ...VALID_FIELDS, ...extra } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Too many form fields');
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('rejects a request without a file', async () => {
    await snapshot();

    const response = await upload(componentId, { file: null });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Attach the photo in the "file" part' });
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('rejects two files', async () => {
    await snapshot();

    const response = await upload(componentId).attach('file', uniqueJpeg(), 'second.jpg');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Send exactly one photo per request' });
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('rejects a file in another part', async () => {
    await snapshot();

    const response = await upload(componentId, { file: null }).attach('photo', uniqueJpeg(), FILE_NAME);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'The photo must be sent in the "file" part' });
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });
});

describe('POST /api/v1/cases/:caseId/evidence — auth (401)', () => {
  it('requires a mobile token', async () => {
    const componentId = await ownComponent('pending');
    const rowsBefore = await countEvidenceRows(componentId);

    const response = await upload(componentId, { bearer: null });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Missing authentication token' });
    expect(await countEvidenceRows(componentId)).toBe(rowsBefore);
  });

  it('refuses an FE web session, as a cookie or as a bearer token', async () => {
    const componentId = await ownComponent('pending');
    const rowsBefore = await countEvidenceRows(componentId);
    const login = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });
    const cookie = extractSessionCookie(login.headers['set-cookie'], 'fs_fe_session');

    const withCookie = await upload(componentId, { bearer: null }).set('Cookie', cookie);
    expect(withCookie.status).toBe(401);

    const webToken = cookie.slice('fs_fe_session='.length);
    const withWebToken = await upload(componentId, { bearer: webToken });
    expect(withWebToken.status).toBe(401);

    expect(await countEvidenceRows(componentId)).toBe(rowsBefore);
  });

  it('refuses an admin session', async () => {
    const componentId = await ownComponent('pending');
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    const response = await upload(componentId, { bearer: null }).set('Cookie', extractSessionCookie(login.headers['set-cookie']));

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
    await expectNothingStored(componentId, 0, 0);
  });

  it('answers 409 for a New component (not accepted yet)', async () => {
    const componentId = await ownComponent('new');

    const response = await upload(componentId);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ success: false, error: 'Accept the case before adding evidence' });
    await expectNothingStored(componentId, 0, 0);
  });

  it('answers 409 for a Completed component', async () => {
    const componentId = await ownComponent('completed');

    const response = await upload(componentId);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ success: false, error: 'Evidence can no longer be added to a completed case' });
    await expectNothingStored(componentId, 0, 0);
  });
});

describe('POST /api/v1/cases/:caseId/evidence — 413 / 415', () => {
  it('answers 413 for a photo over 10 MB, writing nothing', async () => {
    const componentId = await ownComponent('pending');
    const rowsBefore = await countEvidenceRows(componentId);
    const filesBefore = listStoredFiles(componentId).length;

    const response = await upload(componentId, { file: Buffer.concat([uniqueJpeg(), Buffer.alloc(MAX_EVIDENCE_FILE_BYTES)]) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ success: false, error: 'The photo must be 10 MB or smaller' });
    await expectNothingStored(componentId, rowsBefore, filesBefore);
  });

  it('answers 415 for a JSON body', async () => {
    const componentId = await ownComponent('pending');

    const response = await request(app)
      .post(`/api/v1/cases/${componentId}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_FIELDS);

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ success: false, error: 'Upload evidence as multipart/form-data' });
  });

  it('answers 415 for a PNG (or anything else not a JPEG), whatever the client claims', async () => {
    const componentId = await ownComponent('pending');
    const rowsBefore = await countEvidenceRows(componentId);
    const filesBefore = listStoredFiles(componentId).length;

    const png = await upload(componentId, { file: null }).attach('file', PNG, {
      filename: FILE_NAME,
      contentType: 'image/jpeg',
    });
    expect(png.status).toBe(415);
    expect(png.body).toEqual({ success: false, error: 'The photo must be a JPEG image' });

    const script = await upload(componentId, { file: Buffer.from('<script>alert(1)</script>') });
    expect(script.status).toBe(415);

    await expectNothingStored(componentId, rowsBefore, filesBefore);
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

    for (const field of ['document_type_code', 'latitude', 'longitude', 'accuracy_meters', 'is_mock_location', 'captured_at']) {
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
    const web: Document = { ...MOBILE_DOCUMENT, source: 'web_upload', mime_type: 'image/png' };
    for (const field of ['document_type_code', 'latitude', 'longitude', 'accuracy_meters', 'is_mock_location', 'captured_at']) {
      delete web[field];
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
