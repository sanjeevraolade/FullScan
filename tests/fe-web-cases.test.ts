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

interface CaseEntry {
  readonly componentId: string;
  readonly componentStatus: string;
  readonly componentStatusLabel: string;
  readonly tatDueAt: string;
  readonly updatedAt: string;
}

interface CaseGroup {
  readonly bucket: string;
  readonly caseCount: number;
  readonly cases: CaseEntry[];
}

afterAll(() => {
  removeTestDb();
});

async function signIn(account = SEEDED_FIELD_EXECUTIVE): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: account.username, password: account.password });

  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

async function fetchCaseGroups(cookie: string): Promise<CaseGroup[]> {
  const response = await request(app).get('/api/v1/fe-web/cases').set('Cookie', cookie);
  expect(response.status).toBe(200);
  return response.body.data.caseGroups as CaseGroup[];
}

function findAssignedComponentIds(fieldExecutiveId: string, bucket: string): string[] {
  const rows = getDb()
    .prepare(
      'SELECT id FROM case_components WHERE assigned_field_executive_id = ? AND bucket = ?',
    )
    .all(fieldExecutiveId, bucket) as { id: string }[];

  return rows.map((row) => row.id).sort();
}

describe('GET /api/v1/fe-web/cases', () => {
  it('requires a web session', async () => {
    const response = await request(app).get('/api/v1/fe-web/cases');

    expect(response.status).toBe(401);
  });

  it('rejects a mobile token in the session cookie', async () => {
    const mobileToken = jwt.sign({ fieldExecutiveId: SEEDED_FIELD_EXECUTIVE.id }, 'test-jwt-secret', {
      expiresIn: '1h',
    });

    const response = await request(app)
      .get('/api/v1/fe-web/cases')
      .set('Cookie', `fs_fe_session=${mobileToken}`);

    expect(response.status).toBe(401);
  });

  it('returns Pending, Beyond TAT and Completed groups, in that order, and never New', async () => {
    const groups = await fetchCaseGroups(await signIn());

    expect(groups.map((group) => group.bucket)).toEqual(['pending', 'beyond_tat', 'completed']);
  });

  it('lists exactly the components assigned to this executive in each bucket', async () => {
    const groups = await fetchCaseGroups(await signIn());

    for (const group of groups) {
      const expectedIds = findAssignedComponentIds(SEEDED_FIELD_EXECUTIVE.id, group.bucket);

      expect(group.caseCount, group.bucket).toBe(group.cases.length);
      expect(group.cases.map((entry) => entry.componentId).sort(), group.bucket).toEqual(expectedIds);
    }

    // The seed gives fe001 cases in every listed bucket, so this is not vacuous.
    expect(groups.every((group) => group.caseCount > 0)).toBe(true);
  });

  it('never shows one executive another executive’s cases', async () => {
    const ownIds = new Set(
      (await fetchCaseGroups(await signIn())).flatMap((group) =>
        group.cases.map((entry) => entry.componentId),
      ),
    );
    const otherGroups = await fetchCaseGroups(await signIn(OTHER_FIELD_EXECUTIVE));

    for (const group of otherGroups) {
      expect(group.cases.map((entry) => entry.componentId).sort()).toEqual(
        findAssignedComponentIds(OTHER_FIELD_EXECUTIVE.id, group.bucket),
      );
      expect(group.cases.some((entry) => ownIds.has(entry.componentId))).toBe(false);
    }
  });

  it('resolves component status codes to their reference-data labels', async () => {
    const groups = await fetchCaseGroups(await signIn());
    const labels = new Map(
      (
        getDb()
          .prepare("SELECT code, label FROM dropdown_options WHERE category = 'component_status'")
          .all() as { code: string; label: string }[]
      ).map((row) => [row.code, row.label]),
    );

    for (const entry of groups.flatMap((group) => group.cases)) {
      expect(entry.componentStatusLabel).toBe(labels.get(entry.componentStatus) ?? entry.componentStatus);
    }
  });

  it('orders open work by TAT due (soonest first) and completed work by latest update', async () => {
    const groups = await fetchCaseGroups(await signIn());
    const byBucket = new Map(groups.map((group) => [group.bucket, group.cases]));

    for (const bucket of ['pending', 'beyond_tat']) {
      const dueDates = (byBucket.get(bucket) ?? []).map((entry) => entry.tatDueAt);
      expect(dueDates, bucket).toEqual([...dueDates].sort());
    }

    const updated = (byBucket.get('completed') ?? []).map((entry) => entry.updatedAt);
    expect(updated).toEqual([...updated].sort().reverse());
  });

  it('exposes list-level fields only — no contact numbers, GPS targets or detections', async () => {
    const response = await request(app).get('/api/v1/fe-web/cases').set('Cookie', await signIn());
    const body = JSON.stringify(response.body);

    for (const forbidden of ['maskedPrimaryPhone', 'primary_contact_number', 'gpsCheck', 'target_latitude', 'mockLocation']) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it('is read-only — there is no accept route on the web API', async () => {
    const [firstPending] = (await fetchCaseGroups(await signIn()))[0].cases;

    const response = await request(app)
      .patch(`/api/v1/fe-web/cases/${firstPending.componentId}/accept`)
      .set('Cookie', await signIn());

    expect(response.status).toBe(404);
  });
});
