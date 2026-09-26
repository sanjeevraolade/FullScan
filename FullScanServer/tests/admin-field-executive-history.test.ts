import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, extractSessionCookie, removeTestDb, SEEDED_ADMIN } from './helpers/test-app.js';

/**
 * Admin field executive history — /api/v1/admin/field-executives.
 *
 * History is case-wise: each case component the executive holds, with the
 * mock-location detections recorded while they were on it. `case_id` on a
 * detection is a **component** id, because that is the app's unit of work.
 *
 * Cases come back as one group per workflow category. New is excluded — that
 * bucket is the unclaimed shared pool, not work this executive has done.
 */

const ENDPOINT = '/api/v1/admin/field-executives';
const FIELD_EXECUTIVE = { username: 'fe001', password: 'Password123!', id: 'fe-001' };
const DEVICE_ID = 'test-device-history-fe001';

let cookie: string;
let fieldExecutiveToken: string;
let assignedComponentId: string;

/** Posts a detection as the mobile app would, so history has real data to read. */
async function reportMockLocation(overrides: Record<string, unknown> = {}): Promise<void> {
  await request(app)
    .post('/api/v1/security/mock-location')
    .set('Authorization', `Bearer ${fieldExecutiveToken}`)
    .send({
      clientEventId: `hist-evt-${Math.random().toString(36).slice(2)}`,
      detectionStage: 'photo_capture',
      detectedAt: '2026-09-06T10:15:00.000Z',
      fix: {
        latitude: 17.4452,
        longitude: 78.3821,
        accuracyMeters: 8,
        capturedAt: '2026-09-06T10:14:58.000Z',
        source: 'fresh',
      },
      device: {
        deviceId: DEVICE_ID,
        deviceName: 'Pixel 7',
        model: 'Pixel 7',
        brand: 'google',
        manufacturer: 'Google',
        systemName: 'Android',
        osVersion: '14',
        appVersion: '1.4.2',
        isEmulator: false,
        timeZone: 'Asia/Kolkata',
      },
      ...overrides,
    })
    .expect(201);
}

beforeAll(async () => {
  const adminLogin = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

  cookie = extractSessionCookie(adminLogin.headers['set-cookie']);

  const feLogin = await request(app).post('/api/v1/auth/login').send({
    username: FIELD_EXECUTIVE.username,
    password: FIELD_EXECUTIVE.password,
    deviceId: DEVICE_ID,
    deviceDetails: {
      deviceName: 'Pixel 7',
      model: 'Pixel 7',
      brand: 'google',
      osVersion: '14',
      appVersion: '1.4.2',
      systemName: 'Android',
      uniqueId: DEVICE_ID,
    },
  });

  fieldExecutiveToken = feLogin.body.data.token;

  // A pending component: New rows are assigned in the seed data too, but history omits them.
  const assigned = await request(app)
    .get(`/api/v1/admin/cases?fieldExecutiveId=${FIELD_EXECUTIVE.id}&bucket=pending&limit=1`)
    .set('Cookie', cookie);

  assignedComponentId = assigned.body.data.items[0].id;
});

afterAll(async () => {
  await removeTestDb();
});

interface HistoryCase {
  readonly componentId: string;
  readonly bucket: string;
  readonly mockLocationEvents: readonly { readonly detectionStage: string }[];
  readonly [key: string]: unknown;
}

interface HistoryGroup {
  readonly bucket: string;
  readonly caseCount: number;
  readonly mockLocationEventCount: number;
  readonly cases: readonly HistoryCase[];
}

async function fetchHistory(fieldExecutiveId = FIELD_EXECUTIVE.id) {
  const response = await request(app)
    .get(`${ENDPOINT}/${fieldExecutiveId}/history`)
    .set('Cookie', cookie);

  return response.body.data;
}

/** Every case across every group — most assertions do not care which list it sits in. */
function flattenCases(history: { caseGroups: HistoryGroup[] }): HistoryCase[] {
  return history.caseGroups.flatMap((group) => group.cases);
}

function findCase(history: { caseGroups: HistoryGroup[] }, componentId: string) {
  return flattenCases(history).find((entry) => entry.componentId === componentId);
}

function findGroup(history: { caseGroups: HistoryGroup[] }, bucket: string) {
  return history.caseGroups.find((group) => group.bucket === bucket);
}

describe(`GET ${ENDPOINT}`, () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get(ENDPOINT);

    expect(response.status).toBe(401);
  });

  it('lists the roster with assignment and detection counts', async () => {
    const response = await request(app).get(ENDPOINT).set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      assignedComponentCount: expect.any(Number),
      mockLocationEventCount: expect.any(Number),
    });
  });

  it('never exposes the password hash', async () => {
    const response = await request(app).get(ENDPOINT).set('Cookie', cookie);

    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('searches by name or username', async () => {
    const response = await request(app)
      .get(`${ENDPOINT}?search=${FIELD_EXECUTIVE.username}`)
      .set('Cookie', cookie);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(FIELD_EXECUTIVE.id);
  });
});

describe(`GET ${ENDPOINT}/:fieldExecutiveId/history`, () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get(`${ENDPOINT}/${FIELD_EXECUTIVE.id}/history`);

    expect(response.status).toBe(401);
  });

  it('answers 404 for an executive that does not exist', async () => {
    const response = await request(app).get(`${ENDPOINT}/fe-nope/history`).set('Cookie', cookie);

    expect(response.status).toBe(404);
  });

  it('returns the executive with their assigned cases before any detection', async () => {
    const response = await request(app)
      .get(`${ENDPOINT}/${FIELD_EXECUTIVE.id}/history`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.fieldExecutive.id).toBe(FIELD_EXECUTIVE.id);
    expect(flattenCases(response.body.data).length).toBeGreaterThan(0);
    expect(response.body.data.summary.mockLocationEventCount).toBe(0);
    expect(response.body.data.summary.firstDetectedAt).toBeNull();
  });

  it('keeps one headed list per category, in workflow order', async () => {
    const history = await fetchHistory();

    expect(history.caseGroups.map((group: HistoryGroup) => group.bucket)).toEqual([
      'pending',
      'beyond_tat',
      'completed',
    ]);

    for (const group of history.caseGroups as HistoryGroup[]) {
      expect(group.caseCount, group.bucket).toBe(group.cases.length);
      expect(group.cases.every((entry) => entry.bucket === group.bucket), group.bucket).toBe(true);
    }
  });

  it('leaves New cases out entirely, even though the executive is assigned some', async () => {
    const assignedNew = await request(app)
      .get(`/api/v1/admin/cases?fieldExecutiveId=${FIELD_EXECUTIVE.id}&bucket=new&limit=5`)
      .set('Cookie', cookie);

    // The seed data assigns New-bucket components to this executive...
    expect(assignedNew.body.data.items.length).toBeGreaterThan(0);

    // ...and none of them reach the history.
    const history = await fetchHistory();
    expect(findGroup(history, 'new')).toBeUndefined();
    expect(flattenCases(history).some((entry) => entry.bucket === 'new')).toBe(false);
  });

  it('counts only claimed cases as assigned, not the unclaimed pool', async () => {
    const history = await fetchHistory();

    expect(history.summary.assignedComponentCount).toBe(
      history.caseGroups.reduce((total: number, group: HistoryGroup) => total + group.caseCount, 0),
    );
  });

  it('files a detection under the case it was reported against', async () => {
    await reportMockLocation({ caseId: assignedComponentId });

    const history = await fetchHistory();
    const caseEntry = findCase(history, assignedComponentId);

    expect(caseEntry).toBeDefined();
    expect(caseEntry!.mockLocationEvents).toHaveLength(1);
    expect(caseEntry!.caseRef).toBeTypeOf('string');
    expect(caseEntry!.candidateName).toBeTypeOf('string');
  });

  it('rolls the detection up onto its category list', async () => {
    const history = await fetchHistory();
    const pending = findGroup(history, 'pending');

    expect(pending!.mockLocationEventCount).toBe(1);
  });

  it('carries the full detection detail — when, where, and on what handset', async () => {
    const history = await fetchHistory();
    const [event] = findCase(history, assignedComponentId)!.mockLocationEvents as Record<
      string,
      never
    >[];

    expect(event).toMatchObject({
      detectionStage: 'photo_capture',
      detectedAt: '2026-09-06T10:15:00.000Z',
      latitude: 17.4452,
      longitude: 78.3821,
      accuracyMeters: 8,
      fixSource: 'fresh',
    });
    expect(event.reportedAt).toBeTypeOf('string');
    expect(event.device).toMatchObject({
      deviceId: DEVICE_ID,
      model: 'Pixel 7',
      manufacturer: 'Google',
      osName: 'Android',
      osVersion: '14',
      isEmulator: false,
      timeZone: 'Asia/Kolkata',
    });
  });

  it('floats cases with detections to the top of their own list', async () => {
    const history = await fetchHistory();

    expect(findGroup(history, 'pending')!.cases[0].componentId).toBe(assignedComponentId);
  });

  it('keeps a detection reported without a case in the unlinked list', async () => {
    await reportMockLocation({ detectionStage: 'post_login' });

    const history = await fetchHistory();

    expect(history.unlinkedMockLocationEvents).toHaveLength(1);
    expect(history.unlinkedMockLocationEvents[0].detectionStage).toBe('post_login');
  });

  it('summarises detections across every case', async () => {
    const response = await request(app)
      .get(`${ENDPOINT}/${FIELD_EXECUTIVE.id}/history`)
      .set('Cookie', cookie);

    expect(response.body.data.summary).toMatchObject({
      mockLocationEventCount: 2,
      distinctDeviceCount: 1,
    });
    expect(response.body.data.summary.firstDetectedAt).toBeTypeOf('string');
    expect(response.body.data.summary.lastDetectedAt).toBeTypeOf('string');
  });

  it('still shows a detection after the case is reassigned away', async () => {
    const reassigned = findCase(await fetchHistory(), assignedComponentId)!;

    const caseDetail = await request(app)
      .get(`/api/v1/admin/cases/${reassigned.caseId}`)
      .set('Cookie', cookie);

    await request(app)
      .put(`/api/v1/admin/cases/${reassigned.caseId}`)
      .set('Cookie', cookie)
      .send({
        caseRef: caseDetail.body.data.caseRef,
        clientName: caseDetail.body.data.clientName,
        candidateName: caseDetail.body.data.candidateName,
        profileStatus: caseDetail.body.data.profileStatus,
        components: [
          {
            id: assignedComponentId,
            bucket: reassigned.bucket,
            componentStatus: reassigned.componentStatus,
            verificationType: reassigned.verificationType,
            address: reassigned.address,
            assignedFieldExecutiveId: 'fe-002',
          },
        ],
      })
      .expect(200);

    const stillThere = findCase(await fetchHistory(), assignedComponentId);

    expect(stillThere).toBeDefined();
    expect(stillThere!.mockLocationEvents).toHaveLength(1);
  });

  it('gives a New case its own list when a detection points at it, rather than hiding it', async () => {
    const newComponent = (
      await request(app)
        .get(`/api/v1/admin/cases?fieldExecutiveId=${FIELD_EXECUTIVE.id}&bucket=new&limit=1`)
        .set('Cookie', cookie)
    ).body.data.items[0];

    await reportMockLocation({ caseId: newComponent.id, detectionStage: 'manual_recheck' });

    const history = await fetchHistory();
    const newGroup = findGroup(history, 'new');

    // Appended after the three standard lists, never ahead of them.
    expect(history.caseGroups.map((group: HistoryGroup) => group.bucket)).toEqual([
      'pending',
      'beyond_tat',
      'completed',
      'new',
    ]);
    expect(newGroup!.caseCount).toBe(1);
    expect(newGroup!.cases[0].componentId).toBe(newComponent.id);
    expect(newGroup!.mockLocationEventCount).toBe(1);
  });
});
