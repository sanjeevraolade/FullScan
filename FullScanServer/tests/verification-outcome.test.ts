import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Document } from 'mongodb';
import {
  app,
  extractSessionCookie,
  getCollection,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
} from './helpers/test-app.js';
import { signInMobile } from './helpers/mobile-capture.js';
import { VERIFIED_CLEAR_OUTCOME } from './helpers/verification-outcome.js';
import { nowTimestamp } from '../src/db/timestamp.js';

/**
 * `POST /api/v1/cases/:caseId/verification-outcome` —
 * docs/api-contracts/verification-outcome-submission.md.
 *
 * The body is validated by shape and by the `verified_clear` rules (400 `Validation failed`,
 * one detail per failing field), the status code against `dropdown_options` (400 `Unknown
 * verificationStatus`, after the 404 lookup), and every field is stored on the component —
 * never over the back-office `address_type` / `residence_type`.
 */

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

const VALIDATION_FAILED = 'Validation failed';

let token: string;

beforeAll(async () => {
  token = await signInMobile('verification-outcome-test-device');
});

afterAll(async () => {
  await removeTestDb();
});

function outcomePath(componentId: string): string {
  return `/api/v1/cases/${componentId}/verification-outcome`;
}

/** Posts `body` as JSON with the mobile token (or `bearer`; `null` sends none). */
function submit(componentId: string, body: object = VERIFIED_CLEAR_OUTCOME, bearer: string | null = token) {
  const pending = request(app).post(outcomePath(componentId));
  return (bearer ? pending.set('Authorization', `Bearer ${bearer}`) : pending).send(body);
}

/** The outcome body with `key` left out entirely. */
function without(key: keyof typeof VERIFIED_CLEAR_OUTCOME): Record<string, unknown> {
  const { [key]: _omitted, ...rest } = VERIFIED_CLEAR_OUTCOME;
  return rest;
}

async function storedComponent(componentId: string): Promise<Document> {
  const document = await getCollection('case_components').findOne({ _id: componentId });

  if (!document) {
    throw new Error(`No component ${componentId}`);
  }
  return document;
}

/**
 * One of the seeded executive's Pending components with back-office address and residence
 * types. A successful submission moves it to Completed, so each call returns a fresh one.
 */
async function pendingComponent(): Promise<Document> {
  const document = await getCollection('case_components').findOne({
    assigned_field_executive_id: SEEDED_FIELD_EXECUTIVE.id,
    bucket: 'pending',
    address_type: { $ne: null },
    residence_type: { $ne: null },
  });

  if (!document) {
    throw new Error('Seed has no Pending component with address and residence types left');
  }
  return document;
}

async function pendingComponentId(): Promise<string> {
  return String((await pendingComponent())._id);
}

async function expectUnchanged(componentId: string, before: Document): Promise<void> {
  expect(await storedComponent(componentId)).toEqual(before);
}

/** The stored outcome fields of a component, request field → stored value. */
function storedOutcome(document: Document): Record<string, unknown> {
  return {
    verificationStatus: document.selected_verification_status,
    utvReason: document.utv_reason,
    utvRemarks: document.utv_remarks,
    insufficientReason: document.insufficient_reason,
    insufficientRemarks: document.insufficient_remarks,
    residenceType: document.observed_residence_type,
    addressType: document.observed_address_type,
    respondent:
      document.respondent_name === null && document.respondent_relation === null
        ? null
        : { name: document.respondent_name, relation: document.respondent_relation },
    isSignatureCaptured: document.is_signature_captured,
    currentLatitude: document.submitted_latitude,
    currentLongitude: document.submitted_longitude,
    distanceToCaseMeters: document.submitted_distance_meters,
    forceProceed: document.is_force_proceed,
  };
}

/** A 400 from the `validate` middleware with exactly these details. */
function expectValidationFailure(
  response: request.Response,
  details: readonly { readonly path: string; readonly message: string }[],
): void {
  expect(response.status, JSON.stringify(response.body)).toBe(400);
  expect(response.body).toEqual({ success: false, error: VALIDATION_FAILED, details });
}

/** A 400 from the `validate` middleware naming exactly these paths, whatever Zod's wording. */
function expectFailingPaths(response: request.Response, paths: readonly string[]): void {
  expect(response.status, JSON.stringify(response.body)).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toBe(VALIDATION_FAILED);
  expect((response.body.details as { path: string }[]).map((detail) => detail.path)).toEqual(paths);
}

describe('POST /api/v1/cases/:caseId/verification-outcome — success', () => {
  it('stores every field of a verified_clear outcome and completes the component, leaving the back-office address and residence types alone', async () => {
    const before = await pendingComponent();
    const componentId = String(before._id);
    // Observed values that differ from the back office's, so an overwrite would show.
    const residenceType = before.residence_type === 'owned' ? 'hostel' : 'owned';
    const addressType = before.address_type === 'previous' ? 'permanent' : 'previous';
    const startedAt = nowTimestamp();

    const response = await submit(componentId, {
      ...VERIFIED_CLEAR_OUTCOME,
      residenceType,
      addressType,
      respondent: { name: '  Anita Sharma ', relation: '\tMother  ' },
      currentLatitude: 17.4461,
      currentLongitude: 78.3821,
      distanceToCaseMeters: 98.4,
      forceProceed: false,
      unknownExtraKey: 'ignored',
    });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.success).toBe(true);
    // The response shape is unchanged: the case summary, none of the new fields.
    expect(Object.keys(response.body.data).sort()).toEqual(SUMMARY_KEYS);
    expect(response.body.data.id).toBe(componentId);

    const after = await storedComponent(componentId);
    expect(after).toMatchObject({
      bucket: 'completed',
      selected_verification_status: 'verified_clear',
      respondent_name: 'Anita Sharma',
      respondent_relation: 'Mother',
      utv_reason: null,
      utv_remarks: null,
      insufficient_reason: null,
      insufficient_remarks: null,
      observed_residence_type: residenceType,
      observed_address_type: addressType,
      is_signature_captured: true,
      submitted_latitude: 17.4461,
      submitted_longitude: 78.3821,
      submitted_distance_meters: 98.4,
      is_force_proceed: false,
      address_type: before.address_type,
      residence_type: before.residence_type,
    });
    expect(after.outcome_submitted_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(after.outcome_submitted_at >= startedAt).toBe(true);
    expect(after.outcome_submitted_at).toBe(after.updated_at);
    expect(after).not.toHaveProperty('unknownExtraKey');
  });

  it('stores a UTV outcome as sent, with no residence, respondent, signature or location, and records a Force Proceed', async () => {
    const before = await pendingComponent();
    const componentId = String(before._id);
    const outcome = {
      ...VERIFIED_CLEAR_OUTCOME,
      verificationStatus: 'utv',
      utvReason: 'shifted',
      utvRemarks: 'Neighbours say the family moved out in August.',
      residenceType: null,
      addressType: null,
      respondent: null,
      isSignatureCaptured: false,
      currentLatitude: null,
      currentLongitude: null,
      distanceToCaseMeters: null,
      forceProceed: true,
    };

    const response = await submit(componentId, outcome);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const after = await storedComponent(componentId);
    expect(after.bucket).toBe('completed');
    expect(storedOutcome(after)).toEqual(outcome);
    expect(after.address_type).toBe(before.address_type);
    expect(after.residence_type).toBe(before.residence_type);
  });

  it('stores an insufficient outcome as sent, with a location but no distance to the case', async () => {
    const before = await pendingComponent();
    const componentId = String(before._id);
    const outcome = {
      ...VERIFIED_CLEAR_OUTCOME,
      verificationStatus: 'insufficient',
      insufficientReason: 'incorrect_address',
      insufficientRemarks: 'No such house number on the street.',
      residenceType: null,
      addressType: null,
      respondent: null,
      isSignatureCaptured: false,
      currentLatitude: -12.5,
      currentLongitude: -45.25,
      distanceToCaseMeters: null,
      forceProceed: false,
    };

    const response = await submit(componentId, outcome);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const after = await storedComponent(componentId);
    expect(after.bucket).toBe('completed');
    expect(storedOutcome(after)).toEqual(outcome);
  });

  it('accepts a retry of the same body, and a later outcome replaces the earlier one', async () => {
    const componentId = await pendingComponentId();

    const first = await submit(componentId);
    const retry = await submit(componentId);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(storedOutcome(await storedComponent(componentId))).toEqual(VERIFIED_CLEAR_OUTCOME);

    const replacement = {
      ...VERIFIED_CLEAR_OUTCOME,
      verificationStatus: 'utv',
      utvReason: 'resigned',
      residenceType: null,
      addressType: null,
      respondent: null,
      isSignatureCaptured: false,
      forceProceed: true,
    };
    const replaced = await submit(componentId, replacement);

    expect(replaced.status).toBe(200);
    expect(storedOutcome(await storedComponent(componentId))).toEqual(replacement);
  });

  it('stores zero distance and coordinates on the range limits', async () => {
    const componentId = await pendingComponentId();
    const outcome = { ...VERIFIED_CLEAR_OUTCOME, currentLatitude: -90, currentLongitude: 180, distanceToCaseMeters: 0 };

    const response = await submit(componentId, outcome);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(storedOutcome(await storedComponent(componentId))).toEqual(outcome);
  });
});

describe('POST /api/v1/cases/:caseId/verification-outcome — verified_clear rules (400)', () => {
  it.each([
    ['residenceType', { residenceType: null }, 'residenceType is required for verified_clear'],
    ['addressType', { addressType: null }, 'addressType is required for verified_clear'],
    ['respondent', { respondent: null }, 'respondent is required for verified_clear'],
    ['isSignatureCaptured', { isSignatureCaptured: false }, 'isSignatureCaptured must be true for verified_clear'],
  ])('rejects a verified_clear outcome without %s, naming that field', async (field, override, message) => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);

    const response = await submit(componentId, { ...VERIFIED_CLEAR_OUTCOME, ...override });

    expectValidationFailure(response, [{ path: `body.${field}`, message }]);
    await expectUnchanged(componentId, before);
  });

  it('lists every failing field at once, one detail each', async () => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);

    const response = await submit(componentId, {
      ...VERIFIED_CLEAR_OUTCOME,
      residenceType: null,
      addressType: null,
      respondent: null,
      isSignatureCaptured: false,
    });

    expectValidationFailure(response, [
      { path: 'body.residenceType', message: 'residenceType is required for verified_clear' },
      { path: 'body.addressType', message: 'addressType is required for verified_clear' },
      { path: 'body.respondent', message: 'respondent is required for verified_clear' },
      { path: 'body.isSignatureCaptured', message: 'isSignatureCaptured must be true for verified_clear' },
    ]);
    await expectUnchanged(componentId, before);
  });

  it.each([
    ['name', 'verified_clear', { name: '   ', relation: 'Mother' }, 'respondent name must not be blank'],
    ['relation', 'verified_clear', { name: 'Anita Sharma', relation: '\t \n' }, 'respondent relation must not be blank'],
    ['name', 'utv', { name: '  ', relation: 'Mother' }, 'respondent name must not be blank'],
  ])('rejects a whitespace-only respondent %s for a %s outcome', async (field, verificationStatus, respondent, message) => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);

    const response = await submit(componentId, { ...VERIFIED_CLEAR_OUTCOME, verificationStatus, respondent });

    expectValidationFailure(response, [{ path: `body.respondent.${field}`, message }]);
    await expectUnchanged(componentId, before);
  });

  it('checks the length of the trimmed respondent values', async () => {
    const componentId = await pendingComponentId();
    const name = `  ${'a'.repeat(200)}  `;

    const tooLong = await submit(componentId, {
      ...VERIFIED_CLEAR_OUTCOME,
      respondent: { name: `${name}a`, relation: 'Self' },
    });
    expectFailingPaths(tooLong, ['body.respondent.name']);

    const atLimit = await submit(componentId, { ...VERIFIED_CLEAR_OUTCOME, respondent: { name, relation: 'Self' } });
    expect(atLimit.status, JSON.stringify(atLimit.body)).toBe(200);
    expect((await storedComponent(componentId)).respondent_name).toBe('a'.repeat(200));
  });
});

describe('POST /api/v1/cases/:caseId/verification-outcome — shape (400)', () => {
  it.each([
    ['a latitude without a longitude', { currentLongitude: null }, 'body.currentLongitude'],
    ['a longitude without a latitude', { currentLatitude: null }, 'body.currentLatitude'],
  ])('rejects %s', async (_case, override, path) => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);

    const response = await submit(componentId, { ...VERIFIED_CLEAR_OUTCOME, ...override });

    expectFailingPaths(response, [path]);
    await expectUnchanged(componentId, before);
  });

  it.each(['currentLatitude', 'currentLongitude', 'distanceToCaseMeters', 'forceProceed'] as const)(
    'requires %s — it is never defaulted',
    async (key) => {
      const componentId = await pendingComponentId();
      const before = await storedComponent(componentId);

      const response = await submit(componentId, without(key));

      expectValidationFailure(response, [{ path: `body.${key}`, message: 'Required' }]);
      await expectUnchanged(componentId, before);
    },
  );

  it.each([
    ['forceProceed as a string', { forceProceed: 'false' }, 'body.forceProceed'],
    ['forceProceed as null', { forceProceed: null }, 'body.forceProceed'],
    ['a latitude above 90', { currentLatitude: 90.0001 }, 'body.currentLatitude'],
    ['a longitude below -180', { currentLongitude: -180.5 }, 'body.currentLongitude'],
    ['a coordinate as a string', { currentLatitude: '17.4461' }, 'body.currentLatitude'],
    ['a negative distance', { distanceToCaseMeters: -0.1 }, 'body.distanceToCaseMeters'],
    ['an unknown residenceType', { residenceType: 'castle' }, 'body.residenceType'],
    ['an empty verificationStatus', { verificationStatus: '' }, 'body.verificationStatus'],
  ])('rejects %s', async (_case, override, path) => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);

    const response = await submit(componentId, { ...VERIFIED_CLEAR_OUTCOME, ...override });

    expectFailingPaths(response, [path]);
    await expectUnchanged(componentId, before);
  });

  it('rejects an infinite distance (JSON 1e999)', async () => {
    const componentId = await pendingComponentId();
    const raw = JSON.stringify(VERIFIED_CLEAR_OUTCOME).replace('"distanceToCaseMeters":98.4', '"distanceToCaseMeters":1e999');
    expect(raw).toContain('1e999');

    const response = await request(app)
      .post(outcomePath(componentId))
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(raw);

    expectFailingPaths(response, ['body.distanceToCaseMeters']);
  });

  it('reports a missing key as a shape failure, without the verified_clear rules on top', async () => {
    const componentId = await pendingComponentId();

    const response = await submit(componentId, without('residenceType'));

    expectValidationFailure(response, [{ path: 'body.residenceType', message: 'Required' }]);
  });
});

describe('POST /api/v1/cases/:caseId/verification-outcome — unknown status (400)', () => {
  it.each([
    ['a code that does not exist', 'verified'],
    ['a code in the wrong case', 'Verified_Clear'],
    ['a code from another category', 'house_photo_1'],
  ])('rejects %s and writes nothing', async (_case, verificationStatus) => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);

    const response = await submit(componentId, { ...VERIFIED_CLEAR_OUTCOME, verificationStatus });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Unknown verificationStatus' });
    await expectUnchanged(componentId, before);
  });

  it('looks the component up first: an unknown component with an unknown status is 404', async () => {
    const response = await submit('no-such-component', { ...VERIFIED_CLEAR_OUTCOME, verificationStatus: 'verified' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: 'Case component not found: no-such-component' });
  });
});

describe('POST /api/v1/cases/:caseId/verification-outcome — not found (404)', () => {
  /** A component in `bucket` assigned to someone other than the seeded executive (`null` = no one). */
  async function componentNotAssignedToCaller(bucket: string, assignedTo: string | null): Promise<Document> {
    const document = await getCollection('case_components').findOne({
      bucket,
      assigned_field_executive_id: assignedTo ?? null,
    });

    if (!document) {
      throw new Error(`Seed has no ${bucket} component assigned to ${String(assignedTo)}`);
    }
    return document;
  }

  async function otherExecutivesPendingComponent(): Promise<Document> {
    const document = await getCollection('case_components').findOne({
      bucket: 'pending',
      assigned_field_executive_id: { $nin: [SEEDED_FIELD_EXECUTIVE.id, null] },
    });

    if (!document) {
      throw new Error('Seed has no Pending component assigned to another executive');
    }
    return document;
  }

  it('answers 404 for an unknown component id', async () => {
    const response = await submit('no-such-component');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: 'Case component not found: no-such-component' });
  });

  it("answers 404 for another executive's component, exactly as for an unknown id, and writes nothing", async () => {
    const before = await otherExecutivesPendingComponent();
    const componentId = String(before._id);

    const response = await submit(componentId);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: `Case component not found: ${componentId}` });
    await expectUnchanged(componentId, before);
  });

  it('answers 404 for a component assigned to no one, and writes nothing', async () => {
    const before = await componentNotAssignedToCaller('beyond_tat', null);
    const componentId = String(before._id);

    const response = await submit(componentId);

    expect(response.status).toBe(404);
    await expectUnchanged(componentId, before);
  });

  it('accepts the outcome once the executive has accepted a case from the New pool', async () => {
    const newComponent = await componentNotAssignedToCaller('new', null);
    const componentId = String(newComponent._id);

    const beforeAccept = await submit(componentId);
    expect(beforeAccept.status).toBe(404);

    const accept = await request(app)
      .patch(`/api/v1/cases/${componentId}/accept`)
      .set('Authorization', `Bearer ${token}`);
    expect(accept.status).toBe(200);

    const afterAccept = await submit(componentId);
    expect(afterAccept.status).toBe(200);
    expect((await storedComponent(componentId)).bucket).toBe('completed');
  });
});

describe('POST /api/v1/cases/:caseId/verification-outcome — auth (401)', () => {
  it('requires a mobile token', async () => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);

    const response = await submit(componentId, VERIFIED_CLEAR_OUTCOME, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Missing authentication token' });
    await expectUnchanged(componentId, before);
  });

  it('refuses a token that is not a valid JWT', async () => {
    const response = await submit(await pendingComponentId(), VERIFIED_CLEAR_OUTCOME, 'not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Invalid or expired authentication token' });
  });

  it('refuses an FE web session, as a cookie or as a bearer token', async () => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);
    const login = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });
    const cookie = extractSessionCookie(login.headers['set-cookie'], 'fs_fe_session');

    const withCookie = await request(app).post(outcomePath(componentId)).set('Cookie', cookie).send(VERIFIED_CLEAR_OUTCOME);
    expect(withCookie.status).toBe(401);

    const withWebToken = await submit(componentId, VERIFIED_CLEAR_OUTCOME, cookie.slice('fs_fe_session='.length));
    expect(withWebToken.status).toBe(401);
    expect(withWebToken.body).toEqual({ success: false, error: 'Invalid or expired authentication token' });

    await expectUnchanged(componentId, before);
  });

  it('refuses an admin session, as a cookie or as a bearer token', async () => {
    const componentId = await pendingComponentId();
    const before = await storedComponent(componentId);
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });
    const cookie = extractSessionCookie(login.headers['set-cookie']);

    const withCookie = await request(app).post(outcomePath(componentId)).set('Cookie', cookie).send(VERIFIED_CLEAR_OUTCOME);
    expect(withCookie.status).toBe(401);

    const withAdminToken = await submit(componentId, VERIFIED_CLEAR_OUTCOME, cookie.slice('fs_admin_session='.length));
    expect(withAdminToken.status).toBe(401);
    expect(withAdminToken.body).toEqual({ success: false, error: 'Invalid or expired authentication token' });

    await expectUnchanged(componentId, before);
  });
});
