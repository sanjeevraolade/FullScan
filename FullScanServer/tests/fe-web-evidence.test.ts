import fs from 'fs';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Document } from 'mongodb';
import {
  app,
  extractSessionCookie,
  getCollection,
  removeTestDb,
  SEEDED_FIELD_EXECUTIVE,
  testDbDir,
} from './helpers/test-app.js';
import { MAX_EVIDENCE_FILE_BYTES, MAX_EVIDENCE_FILES } from '../src/middleware/evidence-upload.js';
import { signInMobile, uploadMobileCapture } from './helpers/mobile-capture.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

interface EvidenceEntry {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly source: string;
  readonly [field: string]: unknown;
}

/** Every list item carries these; web uploads have them all null. */
const NULL_CAPTURE_FIELDS = {
  documentTypeCode: null,
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  isMockLocation: null,
  capturedAt: null,
};

afterAll(async () => {
  await removeTestDb();
});

async function signIn(account = SEEDED_FIELD_EXECUTIVE): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: account.username, password: account.password });

  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

async function findComponentId(filter: Document): Promise<string> {
  const row = await getCollection('case_components').findOne(filter, { projection: { _id: 1 } });

  if (!row) {
    throw new Error(`Seed has no component matching: ${JSON.stringify(filter)}`);
  }
  return String(row._id);
}

function countEvidenceRows(componentId: string): Promise<number> {
  return getCollection('case_evidence').countDocuments({ component_id: componentId });
}

function listStoredFiles(componentId: string): string[] {
  const dir = path.join(testDbDir, 'uploads', 'evidence', componentId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

describe('POST /api/v1/fe-web/cases/:componentId/evidence', () => {
  it('requires a web session', async () => {
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'pending' });

    const response = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .attach('files', JPEG, 'door.jpg');

    expect(response.status).toBe(401);
  });

  it('stores JPEG, PNG and WebP images, records them and returns the full list', async () => {
    const cookie = await signIn();
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'beyond_tat' });

    const response = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', cookie)
      .attach('files', JPEG, 'door.jpg')
      .attach('files', PNG, 'nameplate.png')
      .attach('files', WEBP, { filename: 'street.webp', contentType: 'application/octet-stream' });

    expect(response.status).toBe(201);
    expect(response.body.data.componentId).toBe(componentId);

    const evidence = response.body.data.evidence as EvidenceEntry[];
    expect(evidence.map((entry) => entry.fileName).sort()).toEqual(['door.jpg', 'nameplate.png', 'street.webp']);
    expect(evidence.map((entry) => entry.mimeType).sort()).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(evidence.every((entry) => entry.source === 'web_upload')).toBe(true);
    for (const entry of evidence) {
      expect(entry).toMatchObject(NULL_CAPTURE_FIELDS);
    }
    expect(await countEvidenceRows(componentId)).toBe(3);
    expect(listStoredFiles(componentId)).toHaveLength(3);
    expect(JSON.stringify(response.body)).not.toContain('storage');

    const listed = await request(app).get(`/api/v1/fe-web/cases/${componentId}/evidence`).set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect((listed.body.data.evidence as EvidenceEntry[]).map((entry) => entry.id).sort()).toEqual(
      evidence.map((entry) => entry.id).sort(),
    );
  });

  it('rejects the whole batch when any file is not a real image, writing nothing', async () => {
    const cookie = await signIn();
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'pending' });

    const response = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', cookie)
      .attach('files', JPEG, 'door.jpg')
      .attach('files', Buffer.from('<script>alert(1)</script>'), { filename: 'fake.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(415);
    expect(response.body.error).toContain('fake.jpg');
    expect(await countEvidenceRows(componentId)).toBe(0);
    expect(listStoredFiles(componentId)).toHaveLength(0);
  });

  it('strips path segments from file names', async () => {
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'pending' });

    const response = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', await signIn())
      .attach('files', JPEG, '..\\..\\etc\\door.jpg');

    expect(response.status).toBe(201);
    expect((response.body.data.evidence as EvidenceEntry[]).map((entry) => entry.fileName)).toContain('door.jpg');
  });

  it('refuses uploads to a completed component', async () => {
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'completed' });

    const response = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', await signIn())
      .attach('files', JPEG, 'door.jpg');

    expect(response.status).toBe(409);
    expect(await countEvidenceRows(componentId)).toBe(0);
  });

  it('answers 404 for another executive’s component', async () => {
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-002', bucket: 'pending' });

    const response = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', await signIn())
      .attach('files', JPEG, 'door.jpg');

    expect(response.status).toBe(404);
    expect(await countEvidenceRows(componentId)).toBe(0);

    const listed = await request(app)
      .get(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', await signIn());
    expect(listed.status).toBe(404);
  });

  it('requires at least one file and a multipart body', async () => {
    const cookie = await signIn();
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'pending' });

    const empty = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', cookie)
      .field('note', 'x')
      .type('multipart/form-data');
    expect([400]).toContain(empty.status);

    const json = await request(app).post(`/api/v1/fe-web/cases/${componentId}/evidence`).set('Cookie', cookie).send({});
    expect(json.status).toBe(415);
  });

  it('enforces the per-file size and file-count limits', async () => {
    const cookie = await signIn();
    const componentId = await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'pending' });
    const before = await countEvidenceRows(componentId);

    const oversized = Buffer.concat([JPEG, Buffer.alloc(MAX_EVIDENCE_FILE_BYTES)]);
    const tooBig = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', cookie)
      .attach('files', oversized, 'huge.jpg');
    expect(tooBig.status).toBe(413);

    let tooMany = request(app).post(`/api/v1/fe-web/cases/${componentId}/evidence`).set('Cookie', cookie);
    for (let index = 0; index <= MAX_EVIDENCE_FILES; index += 1) {
      tooMany = tooMany.attach('files', JPEG, `photo-${index}.jpg`);
    }
    expect((await tooMany).status).toBe(400);

    expect(await countEvidenceRows(componentId)).toBe(before);
  });
});

describe('GET /api/v1/fe-web/cases/:componentId/evidence', () => {
  it('lists mobile captures alongside web uploads, newest first, with the capture fields', async () => {
    const cookie = await signIn();
    const componentId = await findComponentId({
      assigned_field_executive_id: 'fe-001',
      bucket: 'pending',
      _id: { $ne: await findComponentId({ assigned_field_executive_id: 'fe-001', bucket: 'pending' }) },
    });

    const capture = await uploadMobileCapture(await signInMobile(), componentId);
    expect(capture.status).toBe(201);
    const web = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', cookie)
      .attach('files', JPEG, 'door.jpg');
    expect(web.status).toBe(201);

    const listed = await request(app).get(`/api/v1/fe-web/cases/${componentId}/evidence`).set('Cookie', cookie);

    expect(listed.status).toBe(200);
    const evidence = listed.body.data.evidence as EvidenceEntry[];
    expect(evidence).toHaveLength(2);
    // Newest first: the web upload came second (same second → insert order).
    expect(evidence[0]).toMatchObject({ source: 'web_upload', fileName: 'door.jpg', ...NULL_CAPTURE_FIELDS });
    expect(evidence[1]).toEqual(capture.body.data);
    expect(evidence[1]).toMatchObject({
      source: 'mobile_capture',
      documentTypeCode: 'house_photo_1',
      latitude: 17.4935,
      longitude: 78.3129,
      accuracyMeters: 8.5,
      isMockLocation: false,
      capturedAt: '2026-10-04 09:15:02',
    });
    expect(JSON.stringify(listed.body)).not.toContain('storage');
  });
});
