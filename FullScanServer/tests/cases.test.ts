import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, getCollection, removeTestDb, SEEDED_FIELD_EXECUTIVE } from './helpers/test-app.js';

/**
 * Mobile case list by tab — docs/api-contracts/cases-by-tab.md.
 *
 * - `GET /cases/counts` → `{ new, pending, beyond_tat, completed }`.
 * - `GET /cases?type=…[&cursor=…]` → one keyset page of one tab.
 * - `GET /cases` without `type` → the deprecated all-buckets array, unchanged.
 * - The accept / verification-outcome responses use the new case summary shape, and
 *   Case Details carries `checkId` instead of `caseId` but keeps `bucket`.
 *
 * Tests run in order and some move components between buckets (accept, outcome), so
 * every expectation is read from the database at the time it is checked.
 */

const CASES = '/api/v1/cases';
const COUNTS = '/api/v1/cases/counts';
const OTHER_FIELD_EXECUTIVE = { username: 'fe002', password: 'Password123!', id: 'fe-002' };

const SUMMARY_KEYS = [
  'address',
  'candidateName',
  'caseRef',
  'checkId',
  'clientName',
  'id',
  'updatedAt',
  'verificationType',
];
const LEGACY_SUMMARY_KEYS = [
  'address',
  'bucket',
  'candidateName',
  'caseId',
  'caseRef',
  'clientName',
  'id',
  'updatedAt',
  'verificationType',
];
const ASSIGNED_TYPES = ['pending', 'beyond_tat', 'completed'] as const;
const INVALID_CURSOR = { success: false, error: 'Invalid cursor' };

const OUTCOME = {
  verificationStatus: 'verified',
  utvReason: null,
  utvRemarks: null,
  insufficientReason: null,
  insufficientRemarks: null,
  residenceType: 'owned',
  addressType: 'present',
  respondent: { name: 'Test Respondent', relation: 'Self' },
  isSignatureCaptured: true,
};

interface CaseItem {
  readonly id: string;
  readonly checkId: string;
  readonly [key: string]: unknown;
}

interface CasePageBody {
  readonly type: string;
  readonly items: CaseItem[];
  readonly nextCursor: string | null;
  readonly pageSize: number;
}

let token: string;
let otherToken: string;
const originalPageSize = process.env.CASES_PAGE_SIZE;

async function loginMobile(account: { username: string; password: string }, deviceId: string): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({
    username: account.username,
    password: account.password,
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

  expect(response.status).toBe(200);
  return response.body.data.token as string;
}

function get(path: string, query: Record<string, string> = {}, bearer: string = token) {
  return request(app).get(path).query(query).set('Authorization', `Bearer ${bearer}`);
}

async function fetchPage(type: string, cursor?: string | null, bearer: string = token): Promise<CasePageBody> {
  const response = await get(CASES, { type, ...(cursor ? { cursor } : {}) }, bearer);

  expect(response.status, JSON.stringify(response.body)).toBe(200);
  expect(response.body.success).toBe(true);
  return response.body.data as CasePageBody;
}

/** Follows `nextCursor` to the end, checking the page invariants on the way. */
async function fetchAllPages(type: string, bearer: string = token): Promise<{ ids: string[]; pageSizes: number[] }> {
  const ids: string[] = [];
  const pageSizes: number[] = [];
  let cursor: string | null = null;

  for (let guard = 0; guard < 1000; guard += 1) {
    const page = await fetchPage(type, cursor, bearer);

    expect(page.type).toBe(type);
    ids.push(...page.items.map((item) => item.id));
    pageSizes.push(page.items.length);

    if (page.nextCursor === null) {
      return { ids, pageSizes };
    }

    // A cursor is only issued when another row exists, so a page with one is full.
    expect(page.items.length).toBe(page.pageSize);
    cursor = page.nextCursor;
  }

  throw new Error(`Pagination of ${type} did not terminate`);
}

/** The executive's components in a bucket, in the order the list must return them. */
async function assignedIds(fieldExecutiveId: string, bucket: string): Promise<string[]> {
  const rows = await getCollection('case_components')
    .find({ assigned_field_executive_id: fieldExecutiveId, bucket }, { projection: { _id: 1 } })
    .sort({ updated_at: -1, insert_order: 1 })
    .toArray();

  return rows.map((row) => String(row._id));
}

async function unassignedNewComponentId(): Promise<string> {
  const row = await getCollection('case_components').findOne({ bucket: 'new', assigned_field_executive_id: null });

  if (!row) {
    throw new Error('The seed has no unassigned New component left');
  }
  return String(row._id);
}

/**
 * An item that entered a tab has `updated_at = now`, so it is on the first page above
 * everything older. Timestamps have one-second resolution: items that entered in the
 * same second tie and keep their insertion order, so it need not be at index 0.
 */
async function expectAtTopOf(type: string, componentId: string): Promise<void> {
  const { items } = await fetchPage(type);
  const index = items.findIndex((item) => item.id === componentId);

  expect(index, `${componentId} on the first ${type} page`).toBeGreaterThanOrEqual(0);
  const { updatedAt } = items[index];
  expect(items.slice(0, index).every((item) => item.updatedAt === updatedAt)).toBe(true);
  expect(items.every((item) => String(item.updatedAt) <= String(updatedAt))).toBe(true);
}

function setPageSize(value: string): void {
  process.env.CASES_PAGE_SIZE = value;
}

function expectSummaryShape(item: Record<string, unknown>): void {
  expect(Object.keys(item).sort()).toEqual(SUMMARY_KEYS);
  expect(item.checkId).toBe(item.id);
  expect(item).not.toHaveProperty('caseId');
  expect(item).not.toHaveProperty('bucket');
  expect(item.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
}

function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

beforeAll(async () => {
  delete process.env.CASES_PAGE_SIZE;
  token = await loginMobile(SEEDED_FIELD_EXECUTIVE, 'cases-test-handset-fe001');
  otherToken = await loginMobile(OTHER_FIELD_EXECUTIVE, 'cases-test-handset-fe002');

  // The seed stamps every component with one `updated_at`, so ordering would rest on
  // `insert_order` alone. Spread fe001's own components over older timestamps in groups
  // of three, newest group last by insertion: the expected order then differs from
  // insertion order, and every page boundary tests both the timestamp and the tie-break.
  // Older than now, too, so a component moved into a tab during a test lands on top.
  const own = await getCollection('case_components')
    .find({ assigned_field_executive_id: SEEDED_FIELD_EXECUTIVE.id, bucket: { $ne: 'new' } })
    .sort({ insert_order: 1 })
    .toArray();

  for (const [index, component] of own.entries()) {
    const day = String(1 + Math.floor(index / 3)).padStart(2, '0');
    await getCollection('case_components').updateOne(
      { _id: component._id },
      { $set: { updated_at: `2020-01-${day} 08:00:00` } },
    );
  }
});

afterEach(() => {
  delete process.env.CASES_PAGE_SIZE;
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (originalPageSize !== undefined) {
    process.env.CASES_PAGE_SIZE = originalPageSize;
  }
  await removeTestDb();
});

describe('schema', () => {
  it('indexes case_components for the per-tab list and counts', async () => {
    const indexes = await getCollection('case_components').indexes();

    expect(indexes).toContainEqual(
      expect.objectContaining({
        name: 'assigned_bucket_newest_first',
        key: { assigned_field_executive_id: 1, bucket: 1, updated_at: -1, insert_order: 1 },
      }),
    );
  });
});

describe('authentication', () => {
  it.each([COUNTS, `${CASES}?type=pending`, `${CASES}?type=new`, CASES])('rejects %s without a token', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('rejects an FE web token and an admin token on /cases/counts and /cases?type=', async () => {
    const webToken = jwt.sign({ fieldExecutiveId: SEEDED_FIELD_EXECUTIVE.id, scope: 'fe_web' }, 'test-jwt-secret', {
      expiresIn: '1h',
    });
    const adminToken = jwt.sign({ adminUserId: 'admin-001', role: 'super_admin' }, 'test-jwt-secret', {
      expiresIn: '1h',
    });

    for (const bearer of [webToken, adminToken]) {
      expect((await get(COUNTS, {}, bearer)).status).toBe(401);
      expect((await get(CASES, { type: 'pending' }, bearer)).status).toBe(401);
    }
  });
});

describe(`GET ${COUNTS}`, () => {
  it('is not captured by GET /cases/:caseId', async () => {
    const response = await get(COUNTS);

    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty('caseRef');
    expect(response.body.data).not.toHaveProperty('siblingComponents');
    expect(JSON.stringify(response.body)).not.toContain('Case component not found');
  });

  it('returns all four counts as non-negative integers', async () => {
    const response = await get(COUNTS);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Object.keys(response.body.data).sort()).toEqual(['beyond_tat', 'completed', 'new', 'pending']);

    for (const value of Object.values(response.body.data)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value as number).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts only the current executive’s components in each assigned bucket', async () => {
    for (const [bearer, fieldExecutiveId] of [
      [token, SEEDED_FIELD_EXECUTIVE.id],
      [otherToken, OTHER_FIELD_EXECUTIVE.id],
    ] as const) {
      const { data } = (await get(COUNTS, {}, bearer)).body;

      for (const bucket of ASSIGNED_TYPES) {
        expect(data[bucket], `${fieldExecutiveId} ${bucket}`).toBe((await assignedIds(fieldExecutiveId, bucket)).length);
      }
    }

    // The two executives' seeded counts differ, so the scoping is not vacuous.
    const own = (await get(COUNTS)).body.data;
    const other = (await get(COUNTS, {}, otherToken)).body.data;
    expect(own.pending).toBeGreaterThan(0);
    expect([own.pending, own.beyond_tat, own.completed]).not.toEqual([other.pending, other.beyond_tat, other.completed]);
  });

  it('matches the number of rows the list returns for each assigned type', async () => {
    const { data } = (await get(COUNTS)).body;

    for (const type of ASSIGNED_TYPES) {
      expect((await fetchAllPages(type)).ids.length, type).toBe(data[type]);
    }
  });

  it('draws new between 3 and 10 on every call', async () => {
    const draws = new Set<number>();

    for (let call = 0; call < 25; call += 1) {
      const { data } = (await get(COUNTS)).body;
      expect(data.new).toBeGreaterThanOrEqual(3);
      expect(data.new).toBeLessThanOrEqual(10);
      draws.add(data.new);
    }

    // 25 draws from 8 values all landing on one is a ~1e-22 event: the count is random.
    expect(draws.size).toBeGreaterThan(1);
  });

  it('caps new at the size of the new pool', async () => {
    const pool = await getCollection('case_components').find({ bucket: 'new' }, { projection: { _id: 1 } }).toArray();
    const parked = pool.slice(2).map((row) => row._id);

    await getCollection('case_components').updateMany({ _id: { $in: parked } }, { $set: { bucket: 'completed' } });

    try {
      for (let call = 0; call < 5; call += 1) {
        expect((await get(COUNTS)).body.data.new).toBe(2);
      }
    } finally {
      await getCollection('case_components').updateMany({ _id: { $in: parked } }, { $set: { bucket: 'new' } });
    }
  });

  it('rejects any query param as a validation failure', async () => {
    const response = await get(COUNTS, { type: 'pending' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: 'Validation failed' });
    expect(response.body.details).toEqual(expect.any(Array));
  });
});

describe(`GET ${CASES}?type=…`, () => {
  it.each(ASSIGNED_TYPES)('returns every %s component of the current executive, newest first', async (type) => {
    const page = await fetchPage(type);
    const expected = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, type);

    expect(expected.length).toBeGreaterThan(0);
    expect(page).toMatchObject({ type, nextCursor: null, pageSize: 100 });
    expect(Object.keys(page).sort()).toEqual(['items', 'nextCursor', 'pageSize', 'type']);
    expect(page.items.map((item) => item.id)).toEqual(expected);
    page.items.forEach(expectSummaryShape);
  });

  it('orders by updated_at descending with ties broken by insert_order ascending', async () => {
    const ids = (await fetchPage('completed')).items.map((item) => item.id);
    const rows = await getCollection('case_components')
      .find({ _id: { $in: ids } }, { projection: { updated_at: 1, insert_order: 1 } })
      .toArray();
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    const keys = ids.map((id) => {
      const row = byId.get(id);
      if (!row) {
        throw new Error(`Listed component ${id} is not stored`);
      }
      // ObjectId hex strings sort the way the ObjectIds do.
      return { updatedAt: String(row.updated_at), insertOrder: String(row.insert_order) };
    });

    expect(new Set(keys.map((key) => key.updatedAt)).size).toBeGreaterThan(1);
    expect(keys.length).toBeGreaterThan(new Set(keys.map((key) => key.updatedAt)).size);

    for (let index = 1; index < keys.length; index += 1) {
      const previous = keys[index - 1];
      const current = keys[index];

      if (previous.updatedAt === current.updatedAt) {
        expect(previous.insertOrder < current.insertOrder).toBe(true);
      } else {
        expect(previous.updatedAt > current.updatedAt).toBe(true);
      }
    }
  });

  it('never shows one executive another executive’s components', async () => {
    for (const type of ASSIGNED_TYPES) {
      const own = new Set((await fetchAllPages(type)).ids);
      const other = await fetchAllPages(type, otherToken);

      expect(other.ids).toEqual(await assignedIds(OTHER_FIELD_EXECUTIVE.id, type));
      expect(other.ids.some((id) => own.has(id))).toBe(false);
    }
  });

  it('returns a random draw of 3–10 New components as a single page', async () => {
    const page = await fetchPage('new');

    expect(page).toMatchObject({ type: 'new', nextCursor: null, pageSize: 100 });
    expect(page.items.length).toBeGreaterThanOrEqual(3);
    expect(page.items.length).toBeLessThanOrEqual(10);
    expect(new Set(page.items.map((item) => item.id)).size).toBe(page.items.length);
    page.items.forEach(expectSummaryShape);

    const buckets = await getCollection('case_components')
      .find({ _id: { $in: page.items.map((item) => item.id) } }, { projection: { bucket: 1 } })
      .toArray();
    expect(buckets.map((row) => row.bucket)).toEqual(page.items.map(() => 'new'));
  });

  it('keeps New a single page with nextCursor null even when the page size is smaller than the draw', async () => {
    setPageSize('1');

    const page = await fetchPage('new');

    expect(page.nextCursor).toBeNull();
    expect(page.pageSize).toBe(1);
    expect(page.items.length).toBeGreaterThanOrEqual(3);
  });

  describe('pagination', () => {
    it('pages through a tab with no gaps or duplicates', async () => {
      setPageSize('3');
      const expected = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'pending');

      const { ids, pageSizes } = await fetchAllPages('pending');

      expect(expected.length).toBeGreaterThan(6);
      expect(ids).toEqual(expected);
      expect(new Set(ids).size).toBe(ids.length);
      expect(pageSizes.slice(0, -1).every((size) => size === 3)).toBe(true);
      expect(pageSizes.length).toBe(Math.ceil(expected.length / 3));
    });

    it('reports the page size it used', async () => {
      setPageSize('3');

      expect((await fetchPage('pending')).pageSize).toBe(3);
    });

    it('returns nextCursor null on a full last page instead of a cursor to an empty page', async () => {
      const expected = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'beyond_tat');
      setPageSize(String(expected.length));

      const page = await fetchPage('beyond_tat');

      expect(page.items.map((item) => item.id)).toEqual(expected);
      expect(page.nextCursor).toBeNull();
    });

    it('issues a cursor only while another item exists, down to one item per page', async () => {
      setPageSize('1');
      const expected = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'completed');

      const { ids, pageSizes } = await fetchAllPages('completed');

      expect(ids).toEqual(expected);
      expect(pageSizes).toEqual(expected.map(() => 1));
    });

    it('does not skip an item when an already-loaded item leaves the tab mid-scroll', async () => {
      setPageSize('3');
      const expected = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'pending');

      const first = await fetchPage('pending');
      // Submit an outcome on an item already on screen: it moves Pending → Completed.
      const outcome = await request(app)
        .post(`${CASES}/${first.items[0].id}/verification-outcome`)
        .set('Authorization', `Bearer ${token}`)
        .send(OUTCOME);
      expect(outcome.status).toBe(200);

      const rest: string[] = [];
      let cursor = first.nextCursor;
      while (cursor) {
        const page = await fetchPage('pending', cursor);
        rest.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
      }

      // With offsets, the second page would start one item late and skip expected[3].
      expect([...first.items.map((item) => item.id), ...rest]).toEqual(expected);
    });

    it('drops an item that leaves the tab before its page is loaded, with no duplicates', async () => {
      setPageSize('3');
      const expected = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'pending');
      const leaving = expected[4];

      const first = await fetchPage('pending');
      const outcome = await request(app)
        .post(`${CASES}/${leaving}/verification-outcome`)
        .set('Authorization', `Bearer ${token}`)
        .send(OUTCOME);
      expect(outcome.status).toBe(200);

      const ids = first.items.map((item) => item.id);
      let cursor = first.nextCursor;
      while (cursor) {
        const page = await fetchPage('pending', cursor);
        ids.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
      }

      expect(ids).toEqual(expected.filter((id) => id !== leaving));
    });

    it('keeps an in-progress scroll gap-free when a case is accepted between page fetches', async () => {
      setPageSize('3');
      const expected = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'pending');
      const accepted = await unassignedNewComponentId();

      const first = await fetchPage('pending');
      const accept = await request(app).patch(`${CASES}/${accepted}/accept`).set('Authorization', `Bearer ${token}`);
      expect(accept.status).toBe(200);

      const ids = first.items.map((item) => item.id);
      let cursor = first.nextCursor;
      while (cursor) {
        const page = await fetchPage('pending', cursor);
        ids.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
      }

      // The accepted item enters Pending with updated_at = now, i.e. on the first page:
      // the scroll already past it neither sees it nor shifts.
      expect(ids).toEqual(expected);
      await expectAtTopOf('pending', accepted);
    });
  });

  describe('cursor errors', () => {
    async function pendingCursor(): Promise<string> {
      setPageSize('2');
      const { nextCursor } = await fetchPage('pending');
      if (nextCursor === null) {
        throw new Error('Expected Pending to have a second page');
      }
      return nextCursor;
    }

    it('accepts a cursor for the type it was issued for', async () => {
      const cursor = await pendingCursor();

      expect((await get(CASES, { type: 'pending', cursor })).status).toBe(200);
    });

    it.each(['beyond_tat', 'completed'])('rejects a pending cursor sent with type=%s', async (type) => {
      const cursor = await pendingCursor();
      const response = await get(CASES, { type, cursor });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(INVALID_CURSOR);
    });

    it('rejects any cursor with type=new, including one issued for another tab', async () => {
      const cursor = await pendingCursor();

      for (const sent of [cursor, 'anything', encodeCursor({ t: 'new', u: '2020-01-01 08:00:00', o: 'a'.repeat(24) })]) {
        const response = await get(CASES, { type: 'new', cursor: sent });
        expect(response.status, sent).toBe(400);
        expect(response.body).toEqual(INVALID_CURSOR);
      }
    });

    it.each([
      ['an empty cursor', ''],
      ['characters outside base64url', 'not a cursor!'],
      ['base64url that is not JSON', 'abcdef'],
      ['JSON that is not an object', encodeCursor(['pending', '2020-01-01 08:00:00', 'a'.repeat(24)])],
      ['a missing field', encodeCursor({ t: 'pending', u: '2020-01-01 08:00:00' })],
      ['an extra field', encodeCursor({ t: 'pending', u: '2020-01-01 08:00:00', o: 'a'.repeat(24), x: 1 })],
      ['a non-ObjectId insert order', encodeCursor({ t: 'pending', u: '2020-01-01 08:00:00', o: 'zz' })],
      ['a non-string timestamp', encodeCursor({ t: 'pending', u: 5, o: 'a'.repeat(24) })],
      ['an unknown type', encodeCursor({ t: 'archived', u: '2020-01-01 08:00:00', o: 'a'.repeat(24) })],
      ['an over-long cursor', 'A'.repeat(600)],
    ])('rejects %s as Invalid cursor', async (_label, cursor) => {
      const response = await get(CASES, { type: 'pending', cursor });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(INVALID_CURSOR);
    });

    it('rejects a repeated cursor param as a validation failure', async () => {
      const response = await request(app)
        .get(`${CASES}?type=pending&cursor=a&cursor=b`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, error: 'Validation failed' });
    });

    it('rejects a cursor without type as a validation failure', async () => {
      const cursor = await pendingCursor();
      const response = await get(CASES, { cursor });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, error: 'Validation failed' });
      expect(response.body.details).toContainEqual(expect.objectContaining({ path: 'query.cursor' }));
    });
  });

  describe('validation', () => {
    it.each([['bogus'], [''], ['NEW'], ['beyond-tat']])('rejects type=%j', async (type) => {
      const response = await get(CASES, { type });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, error: 'Validation failed' });
      expect(response.body.details).toContainEqual(expect.objectContaining({ path: 'query.type' }));
    });

    it.each([
      [{ type: 'pending', pageSize: '5' }],
      [{ type: 'pending', limit: '5' }],
      [{ type: 'new', offset: '0' }],
      [{ foo: 'bar' }],
    ])('rejects unknown query params %j', async (query) => {
      const response = await get(CASES, query);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, error: 'Validation failed' });
    });
  });

  describe('CASES_PAGE_SIZE', () => {
    it('defaults to 100 without a warning when unset', async () => {
      const { logger } = await import('../src/utils/logger.js');
      const warn = vi.spyOn(logger, 'warn');

      expect((await fetchPage('pending')).pageSize).toBe(100);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each(['1', '500', '42'])('uses the valid value %s', async (value) => {
      setPageSize(value);

      expect((await fetchPage('completed')).pageSize).toBe(Number(value));
    });

    it.each(['0', '501', '-3', '1.5', '10abc', 'abc', '1e2'])(
      'warns and uses 100 for the invalid value %s',
      async (value) => {
        const { logger } = await import('../src/utils/logger.js');
        const warn = vi.spyOn(logger, 'warn');
        setPageSize(value);

        expect((await fetchPage('completed')).pageSize).toBe(100);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][1])).toContain('CASES_PAGE_SIZE');
      },
    );

    it('warns once per invalid value, not on every request', async () => {
      const { logger } = await import('../src/utils/logger.js');
      const warn = vi.spyOn(logger, 'warn');
      setPageSize('not-a-number');

      await fetchPage('completed');
      await fetchPage('pending');
      await get(COUNTS);

      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});

describe(`GET ${CASES} without type (deprecated legacy response)`, () => {
  it('still returns every bucket in one flat array with caseId and bucket', async () => {
    const response = await get(CASES);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const items = response.body.data as Array<Record<string, unknown>>;
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(LEGACY_SUMMARY_KEYS);
      expect(item).not.toHaveProperty('checkId');
    }

    const newItems = items.filter((item) => item.bucket === 'new');
    const assigned = items.filter((item) => item.bucket !== 'new');

    // A random 3–10 New draw first, then the executive's own work, newest first.
    expect(newItems.length).toBeGreaterThanOrEqual(3);
    expect(newItems.length).toBeLessThanOrEqual(10);
    expect(items.slice(0, newItems.length)).toEqual(newItems);

    const expectedAssigned = await getCollection('case_components')
      .find({ assigned_field_executive_id: SEEDED_FIELD_EXECUTIVE.id, bucket: { $ne: 'new' } })
      .sort({ updated_at: -1, insert_order: 1 })
      .toArray();
    expect(assigned.map((item) => item.id)).toEqual(expectedAssigned.map((row) => String(row._id)));
    expect(assigned.map((item) => item.bucket)).toEqual(expectedAssigned.map((row) => row.bucket));
    expect(assigned.map((item) => item.caseId)).toEqual(expectedAssigned.map((row) => row.case_id));
  });

  it('ignores CASES_PAGE_SIZE', async () => {
    setPageSize('1');
    const response = await get(CASES);
    const assigned = (response.body.data as Array<Record<string, unknown>>).filter((item) => item.bucket !== 'new');

    expect(assigned.length).toBeGreaterThan(1);
  });
});

describe(`PATCH ${CASES}/:caseId/accept`, () => {
  it('returns the accepted component in the new case summary shape', async () => {
    const componentId = await unassignedNewComponentId();
    const response = await request(app).patch(`${CASES}/${componentId}/accept`).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expectSummaryShape(response.body.data);
    expect(response.body.data.id).toBe(componentId);

    const stored = await getCollection('case_components').findOne({ _id: componentId });
    expect(stored).toMatchObject({ bucket: 'pending', assigned_field_executive_id: SEEDED_FIELD_EXECUTIVE.id });
    await expectAtTopOf('pending', componentId);
  });

  it('still refuses a component that is not New with 409', async () => {
    const [pendingId] = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'pending');
    const response = await request(app).patch(`${CASES}/${pendingId}/accept`).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('returns 404 for an unknown component and 401 without a token', async () => {
    const missing = await request(app).patch(`${CASES}/no-such-component/accept`).set('Authorization', `Bearer ${token}`);
    const anonymous = await request(app).patch(`${CASES}/${await unassignedNewComponentId()}/accept`);

    expect(missing.status).toBe(404);
    expect(anonymous.status).toBe(401);
  });
});

describe(`POST ${CASES}/:caseId/verification-outcome`, () => {
  it('returns the completed component in the new case summary shape', async () => {
    const [pendingId] = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'pending');
    const response = await request(app)
      .post(`${CASES}/${pendingId}/verification-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send(OUTCOME);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expectSummaryShape(response.body.data);
    expect(response.body.data.id).toBe(pendingId);
    expect((await getCollection('case_components').findOne({ _id: pendingId }))?.bucket).toBe('completed');
    await expectAtTopOf('completed', pendingId);
  });

  it('returns 400 for an invalid body, 404 for an unknown component and 401 without a token', async () => {
    const [pendingId] = await assignedIds(SEEDED_FIELD_EXECUTIVE.id, 'pending');
    const invalid = await request(app)
      .post(`${CASES}/${pendingId}/verification-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...OUTCOME, isSignatureCaptured: 'yes' });
    const missing = await request(app)
      .post(`${CASES}/no-such-component/verification-outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send(OUTCOME);
    const anonymous = await request(app).post(`${CASES}/${pendingId}/verification-outcome`).send(OUTCOME);

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(anonymous.status).toBe(401);
  });
});

describe(`GET ${CASES}/:caseId`, () => {
  it('carries checkId instead of caseId, and keeps bucket and the siblings’ bucket', async () => {
    // A component whose case has siblings, so `siblingComponents` is not empty.
    const [multi] = await getCollection('case_components')
      .aggregate<{ _id: string; ids: string[] }>([
        { $group: { _id: '$case_id', ids: { $push: '$_id' } } },
        { $match: { 'ids.1': { $exists: true } } },
        { $limit: 1 },
      ])
      .toArray();
    const componentId = multi.ids[0];
    const stored = await getCollection('case_components').findOne({ _id: componentId });

    const response = await get(`${CASES}/${componentId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(componentId);
    expect(response.body.data.checkId).toBe(componentId);
    expect(response.body.data).not.toHaveProperty('caseId');
    expect(response.body.data.bucket).toBe(stored?.bucket);
    expect(response.body.data.siblingComponents.length).toBe(multi.ids.length - 1);

    for (const sibling of response.body.data.siblingComponents) {
      const storedSibling = await getCollection('case_components').findOne({ _id: sibling.id });
      expect(sibling.bucket).toBe(storedSibling?.bucket);
    }
  });

  it('returns 404 for an unknown component and 401 without a token', async () => {
    const missing = await get(`${CASES}/no-such-component`);
    const anonymous = await request(app).get(`${CASES}/no-such-component`);

    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
    expect(anonymous.status).toBe(401);
  });
});
