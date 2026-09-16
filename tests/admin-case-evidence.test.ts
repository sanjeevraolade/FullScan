import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  extractSessionCookie,
  getDb,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
  SEEDED_REGULAR_ADMIN,
} from './helpers/test-app.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

interface AdminEvidenceEntry {
  readonly componentId: string;
  readonly fileName: string;
  readonly source: string;
  readonly uploadedBy: { readonly id: string; readonly name: string; readonly username: string };
}

afterAll(() => {
  removeTestDb();
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

function findOwnPendingComponent(): { id: string; caseId: string } {
  const row = getDb()
    .prepare(
      "SELECT id, case_id AS caseId FROM case_components WHERE assigned_field_executive_id = 'fe-001' AND bucket = 'pending' LIMIT 1",
    )
    .get() as { id: string; caseId: string } | undefined;

  if (!row) {
    throw new Error('Seed has no pending component for fe-001');
  }
  return row;
}

describe('GET /api/v1/admin/cases/:caseId/evidence', () => {
  it('requires an admin session', async () => {
    const { caseId } = findOwnPendingComponent();

    expect((await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`)).status).toBe(401);
    expect(
      (await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`).set('Cookie', await signInFieldExecutive()))
        .status,
    ).toBe(401);
  });

  it('is empty for a case nobody has uploaded to', async () => {
    const { caseId } = findOwnPendingComponent();

    const response = await request(app).get(`/api/v1/admin/cases/${caseId}/evidence`).set('Cookie', await signInAdmin());

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ caseId, evidence: [] });
  });

  it('lists web uploads with the uploading executive, for both admin roles', async () => {
    const { id: componentId, caseId } = findOwnPendingComponent();

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
        uploadedBy: { id: SEEDED_FIELD_EXECUTIVE.id, username: SEEDED_FIELD_EXECUTIVE.username },
      });
      expect(JSON.stringify(response.body)).not.toContain('storage');
    }
  });

  it('answers 404 for an unknown case', async () => {
    const response = await request(app).get('/api/v1/admin/cases/no-such-case/evidence').set('Cookie', await signInAdmin());

    expect(response.status).toBe(404);
  });
});
