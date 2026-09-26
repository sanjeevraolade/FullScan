import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, extractSessionCookie, removeTestDb, SEEDED_ADMIN } from './helpers/test-app.js';

/**
 * Admin case management — /api/v1/admin/cases.
 *
 * The list is component-level (a component is what carries a bucket, an assignee
 * and a TAT); create/update operate on a case and the components beneath it.
 */

const ENDPOINT = '/api/v1/admin/cases';

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

function buildCase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    caseRef: `ADMIN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    clientName: 'Acme Corp',
    candidateName: 'Test Candidate',
    fatherOrSpouseName: 'Test Parent',
    employerName: 'Acme Corp',
    primaryContactNumber: '9000000001',
    secondaryContactNumber: '9000000002',
    profileStatus: 'bgv_profile_created',
    components: [
      {
        bucket: 'new',
        componentStatus: 'new_component',
        verificationType: 'Address',
        addressType: 'present',
        residenceType: 'rented',
        address: 'Flat 1, Test Apartments, Madhapur, Hyderabad',
        location: 'Madhapur',
        tatDueAt: '2026-10-01 18:00:00',
        targetLatitude: 17.4483,
        targetLongitude: 78.3915,
        maskedPrimaryPhone: '+91-9XXXXX0001',
        clientInstructions: 'Standard address verification.',
      },
    ],
    ...overrides,
  };
}

async function createCase(body: Record<string, unknown>) {
  return request(app).post(ENDPOINT).set('Cookie', cookie).send(body);
}

describe(`GET ${ENDPOINT}`, () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get(ENDPOINT);

    expect(response.status).toBe(401);
  });

  it('lists components with every workflow category counted', async () => {
    const response = await request(app).get(ENDPOINT).set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.categories.map((c: { bucket: string }) => c.bucket)).toEqual([
      'new',
      'pending',
      'beyond_tat',
      'completed',
    ]);
    expect(response.body.data.total).toBeGreaterThan(0);
  });

  it('carries case-level identity on every component row', async () => {
    const response = await request(app).get(`${ENDPOINT}?limit=1`).set('Cookie', cookie);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: expect.any(String),
      caseId: expect.any(String),
      caseRef: expect.any(String),
      candidateName: expect.any(String),
      bucket: expect.any(String),
    });
  });

  it('filters by category without changing the category counts', async () => {
    const all = await request(app).get(ENDPOINT).set('Cookie', cookie);
    const pending = await request(app).get(`${ENDPOINT}?bucket=pending`).set('Cookie', cookie);

    expect(pending.status).toBe(200);
    expect(pending.body.data.items.every((item: { bucket: string }) => item.bucket === 'pending')).toBe(true);
    expect(pending.body.data.categories).toEqual(all.body.data.categories);
    expect(pending.body.data.total).toBeLessThan(all.body.data.total);
  });

  it('searches by case reference', async () => {
    const created = await createCase(buildCase());
    const caseRef = created.body.data.caseRef as string;

    const response = await request(app)
      .get(`${ENDPOINT}?search=${encodeURIComponent(caseRef)}`)
      .set('Cookie', cookie);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].caseRef).toBe(caseRef);
  });

  it('rejects an unknown category', async () => {
    const response = await request(app).get(`${ENDPOINT}?bucket=archived`).set('Cookie', cookie);

    expect(response.status).toBe(400);
  });

  it('rejects a filter on a field executive that does not exist', async () => {
    const response = await request(app)
      .get(`${ENDPOINT}?fieldExecutiveId=fe-does-not-exist`)
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
  });
});

describe(`GET ${ENDPOINT}/form-options`, () => {
  it('returns the status vocabularies the editor renders', async () => {
    const response = await request(app).get(`${ENDPOINT}/form-options`).set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.buckets).toEqual(['new', 'pending', 'beyond_tat', 'completed']);
    expect(response.body.data.componentStatuses.length).toBeGreaterThan(0);
    expect(response.body.data.profileStatuses[0]).toMatchObject({
      code: expect.any(String),
      label: expect.any(String),
    });
  });
});

describe(`POST ${ENDPOINT}`, () => {
  it('rejects an unauthenticated create', async () => {
    const response = await request(app).post(ENDPOINT).send(buildCase());

    expect(response.status).toBe(401);
  });

  it('creates a case with its components', async () => {
    const response = await createCase(buildCase());

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBeTypeOf('string');
    expect(response.body.data.components).toHaveLength(1);
    expect(response.body.data.components[0]).toMatchObject({
      bucket: 'new',
      verificationType: 'Address',
      addressType: 'present',
      targetLatitude: 17.4483,
    });
  });

  it('makes the new case visible in the list', async () => {
    const created = await createCase(buildCase({ candidateName: 'Listed Candidate' }));

    const response = await request(app)
      .get(`${ENDPOINT}?search=${encodeURIComponent(created.body.data.caseRef)}`)
      .set('Cookie', cookie);

    expect(response.body.data.items[0].candidateName).toBe('Listed Candidate');
  });

  it('accepts several components on one case', async () => {
    const response = await createCase(
      buildCase({
        components: [
          {
            bucket: 'new',
            componentStatus: 'new_component',
            verificationType: 'Address',
            addressType: 'present',
            address: 'Present address, Hyderabad',
          },
          {
            bucket: 'pending',
            componentStatus: 'new_component',
            verificationType: 'Employment',
            address: 'Employer address, Hyderabad',
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.components).toHaveLength(2);
  });

  it('assigns a component to a field executive', async () => {
    const response = await createCase(
      buildCase({
        components: [
          {
            bucket: 'pending',
            componentStatus: 'new_component',
            verificationType: 'Address',
            address: 'Assigned address, Hyderabad',
            assignedFieldExecutiveId: 'fe-001',
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.components[0].assignedFieldExecutiveId).toBe('fe-001');
    expect(response.body.data.components[0].assignedFieldExecutiveName).toBeTypeOf('string');
  });

  it('rejects a duplicate case reference', async () => {
    const first = await createCase(buildCase());
    const response = await createCase(buildCase({ caseRef: first.body.data.caseRef }));

    expect(response.status).toBe(409);
  });

  it('rejects a case with no components', async () => {
    const response = await createCase(buildCase({ components: [] }));

    expect(response.status).toBe(400);
  });

  it('rejects an unknown component status', async () => {
    const response = await createCase(
      buildCase({
        components: [
          {
            bucket: 'new',
            componentStatus: 'not_a_real_status',
            verificationType: 'Address',
            address: 'Somewhere, Hyderabad',
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects an unknown profile status', async () => {
    const response = await createCase(buildCase({ profileStatus: 'not_a_real_status' }));

    expect(response.status).toBe(400);
  });

  it('rejects an assignee that does not exist', async () => {
    const response = await createCase(
      buildCase({
        components: [
          {
            bucket: 'new',
            componentStatus: 'new_component',
            verificationType: 'Address',
            address: 'Somewhere, Hyderabad',
            assignedFieldExecutiveId: 'fe-nope',
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
  });

  it('writes nothing when one component in the payload is invalid', async () => {
    const body = buildCase({
      components: [
        {
          bucket: 'new',
          componentStatus: 'new_component',
          verificationType: 'Address',
          address: 'Valid component, Hyderabad',
        },
        {
          bucket: 'new',
          componentStatus: 'not_a_real_status',
          verificationType: 'Address',
          address: 'Invalid component, Hyderabad',
        },
      ],
    });

    const response = await createCase(body);
    expect(response.status).toBe(400);

    const list = await request(app)
      .get(`${ENDPOINT}?search=${encodeURIComponent(body.caseRef as string)}`)
      .set('Cookie', cookie);

    expect(list.body.data.total).toBe(0);
  });
});

describe(`PUT ${ENDPOINT}/:caseId`, () => {
  it('updates case-level fields', async () => {
    const created = await createCase(buildCase());
    const { id, caseRef, components } = created.body.data;

    const response = await request(app)
      .put(`${ENDPOINT}/${id}`)
      .set('Cookie', cookie)
      .send({
        caseRef,
        clientName: 'Renamed Client',
        candidateName: 'Renamed Candidate',
        profileStatus: 'wip',
        components: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.clientName).toBe('Renamed Client');
    expect(response.body.data.profileStatus).toBe('wip');
    // Components left out of the payload are untouched, not deleted.
    expect(response.body.data.components).toHaveLength(components.length);
  });

  it('updates an existing component in place', async () => {
    const created = await createCase(buildCase());
    const { id, caseRef, components } = created.body.data;

    const response = await request(app)
      .put(`${ENDPOINT}/${id}`)
      .set('Cookie', cookie)
      .send({
        caseRef,
        clientName: 'Acme Corp',
        candidateName: 'Test Candidate',
        profileStatus: 'wip',
        components: [
          {
            id: components[0].id,
            bucket: 'beyond_tat',
            componentStatus: 'insuff_raised',
            actionStatus: 'rejected',
            verificationType: 'Address',
            addressType: 'permanent',
            address: 'Updated address, Hyderabad',
            assignedFieldExecutiveId: 'fe-001',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.components).toHaveLength(1);
    expect(response.body.data.components[0]).toMatchObject({
      id: components[0].id,
      bucket: 'beyond_tat',
      componentStatus: 'insuff_raised',
      actionStatus: 'rejected',
      addressType: 'permanent',
      address: 'Updated address, Hyderabad',
      assignedFieldExecutiveId: 'fe-001',
    });
  });

  it('adds a component that arrives without an id', async () => {
    const created = await createCase(buildCase());
    const { id, caseRef } = created.body.data;

    const response = await request(app)
      .put(`${ENDPOINT}/${id}`)
      .set('Cookie', cookie)
      .send({
        caseRef,
        clientName: 'Acme Corp',
        candidateName: 'Test Candidate',
        profileStatus: 'wip',
        components: [
          {
            bucket: 'new',
            componentStatus: 'new_component',
            verificationType: 'Education',
            address: 'College address, Hyderabad',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.components).toHaveLength(2);
    expect(
      response.body.data.components.some(
        (component: { verificationType: string }) => component.verificationType === 'Education',
      ),
    ).toBe(true);
  });

  it('refuses a component belonging to another case', async () => {
    const first = await createCase(buildCase());
    const second = await createCase(buildCase());

    const response = await request(app)
      .put(`${ENDPOINT}/${second.body.data.id}`)
      .set('Cookie', cookie)
      .send({
        caseRef: second.body.data.caseRef,
        clientName: 'Acme Corp',
        candidateName: 'Test Candidate',
        profileStatus: 'wip',
        components: [
          {
            id: first.body.data.components[0].id,
            bucket: 'new',
            componentStatus: 'new_component',
            verificationType: 'Address',
            address: 'Hijacked address, Hyderabad',
          },
        ],
      });

    expect(response.status).toBe(404);
  });

  it('refuses a case reference already used by another case', async () => {
    const first = await createCase(buildCase());
    const second = await createCase(buildCase());

    const response = await request(app)
      .put(`${ENDPOINT}/${second.body.data.id}`)
      .set('Cookie', cookie)
      .send({
        caseRef: first.body.data.caseRef,
        clientName: 'Acme Corp',
        candidateName: 'Test Candidate',
        profileStatus: 'wip',
        components: [],
      });

    expect(response.status).toBe(409);
  });

  it('answers 404 for a case that does not exist', async () => {
    const response = await request(app)
      .put(`${ENDPOINT}/case-does-not-exist`)
      .set('Cookie', cookie)
      .send({
        caseRef: 'ANY-REF-0001',
        clientName: 'Acme Corp',
        candidateName: 'Test Candidate',
        profileStatus: 'wip',
        components: [],
      });

    expect(response.status).toBe(404);
  });
});

describe(`GET ${ENDPOINT}/:caseId`, () => {
  it('returns the case with all of its components', async () => {
    const created = await createCase(buildCase());

    const response = await request(app)
      .get(`${ENDPOINT}/${created.body.data.id}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.caseRef).toBe(created.body.data.caseRef);
    expect(response.body.data.components).toHaveLength(1);
  });

  it('answers 404 for a case that does not exist', async () => {
    const response = await request(app)
      .get(`${ENDPOINT}/case-does-not-exist`)
      .set('Cookie', cookie);

    expect(response.status).toBe(404);
  });
});
