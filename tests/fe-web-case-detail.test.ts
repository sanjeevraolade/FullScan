import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  app,
  extractSessionCookie,
  getDb,
  removeTestDb,
  SEEDED_FIELD_EXECUTIVE,
} from './helpers/test-app.js';

const OTHER_FIELD_EXECUTIVE = { username: 'fe002', password: 'Password123!', id: 'fe-002' };

afterAll(() => {
  removeTestDb();
});

async function signIn(account = SEEDED_FIELD_EXECUTIVE): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: account.username, password: account.password });

  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

function findComponentId(where: string, ...params: string[]): string {
  const row = getDb().prepare(`SELECT id FROM case_components WHERE ${where} LIMIT 1`).get(...params) as
    | { id: string }
    | undefined;

  if (!row) {
    throw new Error(`Seed has no component matching: ${where}`);
  }
  return row.id;
}

describe('GET /api/v1/fe-web/cases/:componentId', () => {
  it('requires a web session', async () => {
    const componentId = findComponentId("assigned_field_executive_id = ? AND bucket = 'pending'", 'fe-001');

    const response = await request(app).get(`/api/v1/fe-web/cases/${componentId}`);

    expect(response.status).toBe(401);
  });

  it('rejects a mobile token', async () => {
    const componentId = findComponentId("assigned_field_executive_id = ? AND bucket = 'pending'", 'fe-001');
    const mobileToken = jwt.sign({ fieldExecutiveId: SEEDED_FIELD_EXECUTIVE.id }, 'test-jwt-secret');

    const response = await request(app)
      .get(`/api/v1/fe-web/cases/${componentId}`)
      .set('Cookie', `fs_fe_session=${mobileToken}`);

    expect(response.status).toBe(401);
  });

  it('returns an own pending component with evidence open', async () => {
    const componentId = findComponentId("assigned_field_executive_id = ? AND bucket = 'pending'", 'fe-001');

    const response = await request(app).get(`/api/v1/fe-web/cases/${componentId}`).set('Cookie', await signIn());

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      componentId,
      bucket: 'pending',
      canUploadEvidence: true,
    });
    expect(typeof response.body.data.caseRef).toBe('string');
    expect(typeof response.body.data.location).toBe('string');
    expect(Array.isArray(response.body.data.siblingComponents)).toBe(true);
  });

  it('closes evidence on a completed component', async () => {
    const componentId = findComponentId("assigned_field_executive_id = ? AND bucket = 'completed'", 'fe-001');

    const response = await request(app).get(`/api/v1/fe-web/cases/${componentId}`).set('Cookie', await signIn());

    expect(response.status).toBe(200);
    expect(response.body.data.canUploadEvidence).toBe(false);
  });

  it('answers 404 for another executive’s component, an unclaimed New one, and an unknown id', async () => {
    const cookie = await signIn();
    const othersId = findComponentId("assigned_field_executive_id = ? AND bucket = 'pending'", OTHER_FIELD_EXECUTIVE.id);
    const newId = findComponentId("bucket = 'new'");

    for (const componentId of [othersId, newId, 'does-not-exist']) {
      const response = await request(app).get(`/api/v1/fe-web/cases/${componentId}`).set('Cookie', cookie);
      expect(response.status, componentId).toBe(404);
      expect(response.body.error).toBe('Case not found');
    }
  });

  it('exposes no contact numbers, GPS targets or respondent details', async () => {
    const componentId = findComponentId("assigned_field_executive_id = ? AND bucket = 'pending'", 'fe-001');

    const response = await request(app).get(`/api/v1/fe-web/cases/${componentId}`).set('Cookie', await signIn());
    const body = JSON.stringify(response.body);

    for (const forbidden of ['maskedPrimaryPhone', 'contact_number', 'gpsCheck', 'target_latitude', 'respondent']) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it('only marks siblings this executive holds as openable', async () => {
    const cookie = await signIn();
    const componentIds = (
      getDb()
        .prepare("SELECT id FROM case_components WHERE assigned_field_executive_id = 'fe-001' AND bucket != 'new'")
        .all() as { id: string }[]
    ).map((row) => row.id);

    for (const componentId of componentIds) {
      const response = await request(app).get(`/api/v1/fe-web/cases/${componentId}`).set('Cookie', cookie);

      for (const sibling of response.body.data.siblingComponents as { componentId: string; isAssignedToYou: boolean }[]) {
        const row = getDb()
          .prepare('SELECT assigned_field_executive_id, bucket FROM case_components WHERE id = ?')
          .get(sibling.componentId) as { assigned_field_executive_id: string | null; bucket: string };
        const expected = row.assigned_field_executive_id === 'fe-001' && row.bucket !== 'new';
        expect(sibling.isAssignedToYou, sibling.componentId).toBe(expected);
      }
    }
  });
});
