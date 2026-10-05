import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  extractSessionCookie,
  getCollection,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
  SEEDED_REGULAR_ADMIN,
} from './helpers/test-app.js';
import { signInMobile, uploadMobileCapture } from './helpers/mobile-capture.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

interface AdminEvidenceEntry {
  readonly id: string;
  readonly componentId: string;
  readonly fileName: string;
  readonly source: string;
  readonly uploadedBy: { readonly id: string; readonly name: string; readonly username: string };
  readonly [field: string]: unknown;
}

afterAll(async () => {
  await removeTestDb();
});

async function signInAdmin(account: { username: string; password: string } = SEEDED_ADMIN): Promise<string> {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: account.username, password: account.password });
  return extractSessionCookie(response.headers['set-cookie']);
}

async function signInFieldExecutive(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });
  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

async function findOwnPendingComponent(): Promise<{ id: string; caseId: string }> {
  const row = await getCollection('case_components')
    .findOne({ assigned_field_executive_id: 'fe-001', bucket: 'pending' }, { projection: { _id: 1, case_id: 1 } });

  if (!row) {
    throw new Error('Seed has no pending component for fe-001');
  }
  return { id: String(row._id), caseId: row.case_id as string };
}

describe('GET /api/v1/admin/cases/:caseId/evidence', () => {
  it('requires an admin session', async () => {
    const { caseId } = await findOwnPendingComponent();

    expect((await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`)).status).toBe(401);
    expect(
      (await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`).set('Cookie', await signInFieldExecutive()))
        .status,
    ).toBe(401);
  });

  it('is empty for a case nobody has uploaded to', async () => {
    const { caseId } = await findOwnPendingComponent();

    const response = await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`).set('Cookie', await signInAdmin());

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ caseId, evidence: [] });
  });

  it('lists web uploads with the uploading executive, for both admin roles', async () => {
    const { id: componentId, caseId } = await findOwnPendingComponent();

    const upload = await request(app)
      .post(`/api/v1/fe-web/cases/${componentId}/evidence`)
      .set('Cookie', await signInFieldExecutive())
      .attach('files', JPEG, 'gate.jpg');
    expect(upload.status).toBe(201);

    for (const account of [SEEDED_ADMIN, SEEDED_REGULAR_ADMIN]) {
      const response = await request(app)
        .get(`/api/v1/admin/cases/${caseId}/evidence`)
        .set('Cookie', await signInAdmin(account));

      expect(response.status, account.username).toBe(200);
      const evidence = response.body.data.evidence as AdminEvidenceEntry[];
      expect(evidence).toHaveLength(1);
      expect(evidence[0]).toMatchObject({
        componentId,
        fileName: 'gate.jpg',
        source: 'web_upload',
        documentTypeCode: null,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        isMockLocation: null,
        capturedAt: null,
        uploadedBy: { id: SEEDED_FIELD_EXECUTIVE.id, username: SEEDED_FIELD_EXECUTIVE.username },
      });
      expect(JSON.stringify(response.body)).not.toContain('storage');
    }
  });

  it('lists mobile captures from every component of the case, with their capture fields and uploader', async () => {
    const { id: componentId, caseId } = await findOwnPendingComponent();
    const before = await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`).set('Cookie', await signInAdmin());
    const countBefore = (before.body.data.evidence as AdminEvidenceEntry[]).length;

    const capture = await uploadMobileCapture(await signInMobile(), componentId, {
      documentTypeCode: 'house_photo_2',
      latitude: -12.5,
      longitude: 130,
      accuracyMeters: 25,
      capturedAt: '2026-10-04T10:00:00+05:30',
      isMockLocation: true,
    });
    expect(capture.status).toBe(201);

    const response = await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`).set('Cookie', await signInAdmin());

    expect(response.status).toBe(200);
    const evidence = response.body.data.evidence as AdminEvidenceEntry[];
    expect(evidence).toHaveLength(countBefore + 1);
    // Newest first.
    expect(evidence[0]).toEqual({
      ...capture.body.data,
      uploadedBy: {
        id: SEEDED_FIELD_EXECUTIVE.id,
        name: expect.any(String),
        username: SEEDED_FIELD_EXECUTIVE.username,
      },
    });
    expect(evidence[0]).toMatchObject({
      componentId,
      source: 'mobile_capture',
      documentTypeCode: 'house_photo_2',
      latitude: -12.5,
      longitude: 130,
      accuracyMeters: 25,
      isMockLocation: true,
      capturedAt: '2026-10-04 04:30:00',
    });
    expect(JSON.stringify(response.body)).not.toContain('storage');
  });

  it('answers 404 for an unknown case', async () => {
    const response = await request(app).get('/api/v1/admin/cases/no-such-case/evidence').set('Cookie', await signInAdmin());

    expect(response.status).toBe(404);
  });
});
