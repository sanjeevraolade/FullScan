import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  app,
  extractSessionCookie,
  getCollection,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_INACTIVE_ADMIN,
  SEEDED_REGULAR_ADMIN,
} from './helpers/test-app.js';
import { generateTemporaryPassword } from '../src/services/admin-user.service.js';

/**
 * Super Admin functionality — what each admin role can reach, and adding admins by email.
 *
 *   super_admin  Mobile App Settings · Cases · Field Executive History · Add New Case · Add New Admin
 *   admin        Cases · Field Executive History · Add New Case
 */

const LOGIN = '/api/v1/admin/auth/login';
const SETTINGS = '/api/v1/admin/mobile-app-settings';
const ADMIN_USERS = '/api/v1/admin/admin-users';
const CASES = '/api/v1/admin/cases';
const FIELD_EXECUTIVES = '/api/v1/admin/field-executives';

let superAdminCookie: string;
let adminCookie: string;

async function signIn(username: string, password: string): Promise<string> {
  const response = await request(app).post(LOGIN).send({ username, password });
  return extractSessionCookie(response.headers['set-cookie']);
}

function buildCase(): Record<string, unknown> {
  return {
    caseRef: `ROLE-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    clientName: 'Acme Corp',
    candidateName: 'Role Test Candidate',
    profileStatus: 'bgv_profile_created',
    components: [
      {
        bucket: 'new',
        componentStatus: 'new_component',
        verificationType: 'Address',
        addressType: 'present',
        address: 'Flat 2, Test Apartments, Madhapur, Hyderabad',
        targetLatitude: 17.4483,
        targetLongitude: 78.3915,
      },
    ],
  };
}

function countAdminUsers(): Promise<number> {
  return getCollection('admin_users').countDocuments();
}

beforeAll(async () => {
  superAdminCookie = await signIn(SEEDED_ADMIN.username, SEEDED_ADMIN.password);
  adminCookie = await signIn(SEEDED_REGULAR_ADMIN.username, SEEDED_REGULAR_ADMIN.password);
});

afterAll(async () => {
  await removeTestDb();
});

describe('super admin access', () => {
  it('reads and writes Mobile App Settings', async () => {
    const read = await request(app).get(SETTINGS).set('Cookie', superAdminCookie);
    expect(read.status).toBe(200);

    const write = await request(app)
      .put(SETTINGS)
      .set('Cookie', superAdminCookie)
      .send({ settings: [{ key: 'sync_on_wifi_only', value: true }] });
    expect(write.status).toBe(200);
  });

  it('reaches Cases, Field Executive History and the admin list', async () => {
    for (const path of [CASES, `${CASES}/form-options`, FIELD_EXECUTIVES, ADMIN_USERS]) {
      const response = await request(app).get(path).set('Cookie', superAdminCookie);
      expect(response.status, path).toBe(200);
    }
  });
});

describe('admin access', () => {
  it('is refused Mobile App Settings with 403, on read and on write', async () => {
    const read = await request(app).get(SETTINGS).set('Cookie', adminCookie);
    expect(read.status).toBe(403);
    expect(read.body).toEqual({
      success: false,
      error: 'Your admin role does not have access to this feature',
    });

    const write = await request(app)
      .put(SETTINGS)
      .set('Cookie', adminCookie)
      .send({ settings: [{ key: 'geo_fence_radius_meters', value: 1234 }] });
    expect(write.status).toBe(403);
  });

  it('changes nothing when its settings write is refused', async () => {
    await request(app)
      .put(SETTINGS)
      .set('Cookie', adminCookie)
      .send({ settings: [{ key: 'geo_fence_radius_meters', value: 1500 }] });

    const row = await getCollection('mobile_app_settings').findOne({ _id: 'geo_fence_radius_meters' });
    expect(row?.setting_value).not.toBe('1500');
  });

  it('is refused the role check before body validation, so a bad body still gets 403', async () => {
    const response = await request(app).put(SETTINGS).set('Cookie', adminCookie).send({});
    expect(response.status).toBe(403);
  });

  it('is refused the admin list and cannot add an admin', async () => {
    const before = await countAdminUsers();

    const list = await request(app).get(ADMIN_USERS).set('Cookie', adminCookie);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', adminCookie)
      .send({ name: 'Sneaky Escalation', email: 'sneaky@fullscan.test', role: 'super_admin' });
    expect(create.status).toBe(403);
    expect(await countAdminUsers()).toBe(before);
  });

  it('can view Cases and Field Executive History', async () => {
    for (const path of [CASES, `${CASES}/form-options`, FIELD_EXECUTIVES]) {
      const response = await request(app).get(path).set('Cookie', adminCookie);
      expect(response.status, path).toBe(200);
    }

    const roster = await request(app).get(FIELD_EXECUTIVES).set('Cookie', adminCookie);
    const history = await request(app)
      .get(`${FIELD_EXECUTIVES}/${roster.body.data[0].id}/history`)
      .set('Cookie', adminCookie);
    expect(history.status).toBe(200);
  });

  it('can add a new case', async () => {
    const response = await request(app).post(CASES).set('Cookie', adminCookie).send(buildCase());

    expect(response.status).toBe(201);
    expect(response.body.data.components).toHaveLength(1);
  });
});

describe('role changes take effect on the next request', () => {
  it('promotes and demotes an already signed-in admin without a new sign-in', async () => {
    const cookie = await signIn('admin003', 'Admin@123!');
    const adminUsers = getCollection('admin_users');

    expect((await request(app).get(SETTINGS).set('Cookie', cookie)).status).toBe(403);

    await adminUsers.updateOne({ _id: 'admin-003' }, { $set: { role: 'super_admin' } });
    try {
      expect((await request(app).get(SETTINGS).set('Cookie', cookie)).status).toBe(200);
      const me = await request(app).get('/api/v1/admin/auth/me').set('Cookie', cookie);
      expect(me.body.data.role).toBe('super_admin');
    } finally {
      await adminUsers.updateOne({ _id: 'admin-003' }, { $set: { role: 'admin' } });
    }

    // The token still says super_admin; the row no longer does.
    expect((await request(app).get(SETTINGS).set('Cookie', cookie)).status).toBe(403);
  });
});

describe(`GET ${ADMIN_USERS}`, () => {
  it('rejects an unauthenticated request', async () => {
    expect((await request(app).get(ADMIN_USERS)).status).toBe(401);
  });

  it('lists every admin, super admins first, without password hashes', async () => {
    const response = await request(app).get(ADMIN_USERS).set('Cookie', superAdminCookie);
    const admins = response.body.data as Array<Record<string, unknown>>;

    expect(admins.map((admin) => admin.id)).toEqual(
      expect.arrayContaining(['admin-001', 'admin-002', 'admin-003', 'admin-004']),
    );
    expect(admins[0].role).toBe('super_admin');
    expect(JSON.stringify(response.body)).not.toMatch(/password|\$2[aby]\$/i);

    const inactive = admins.find((admin) => admin.id === 'admin-004');
    expect(inactive).toMatchObject({ isActive: false, createdBy: null });
  });
});

describe(`POST ${ADMIN_USERS}`, () => {
  async function createAdmin(body: Record<string, unknown>) {
    return request(app).post(ADMIN_USERS).set('Cookie', superAdminCookie).send(body);
  }

  it('rejects an unauthenticated request', async () => {
    const response = await request(app)
      .post(ADMIN_USERS)
      .send({ name: 'Anon', email: 'anon@fullscan.test' });
    expect(response.status).toBe(401);
  });

  it('adds an admin by email, defaulting the role to admin', async () => {
    const response = await createAdmin({ name: '  Kavya Reddy ', email: ' Kavya.Reddy@FullScan.test ' });

    expect(response.status).toBe(201);
    expect(response.body.data.adminUser).toMatchObject({
      name: 'Kavya Reddy',
      email: 'kavya.reddy@fullscan.test',
      username: 'kavya.reddy@fullscan.test',
      role: 'admin',
      isActive: true,
      lastLoginAt: null,
      createdBy: SEEDED_ADMIN.id,
    });
    expect(response.body.data.temporaryPassword).toBeTypeOf('string');
  });

  it('stores only a bcrypt hash of the temporary password', async () => {
    const response = await createAdmin({ name: 'Hash Check', email: 'hash.check@fullscan.test' });
    const { adminUser, temporaryPassword } = response.body.data;

    const row = await getCollection('admin_users').findOne({ _id: adminUser.id });
    const passwordHash = String(row?.password_hash);

    expect(passwordHash).not.toContain(temporaryPassword);
    expect(bcrypt.compareSync(temporaryPassword, passwordHash)).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(passwordHash);
  });

  it('lets the new admin sign in with their email and temporary password, with admin access only', async () => {
    const created = await createAdmin({ name: 'Arjun Das', email: 'arjun.das@fullscan.test' });
    const { temporaryPassword } = created.body.data;

    const login = await request(app)
      .post(LOGIN)
      .send({ username: 'ARJUN.DAS@fullscan.test', password: temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.adminUser.role).toBe('admin');

    const cookie = extractSessionCookie(login.headers['set-cookie']);
    expect((await request(app).get(CASES).set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get(SETTINGS).set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get(ADMIN_USERS).set('Cookie', cookie)).status).toBe(403);
  });

  it('can add another super admin, who then has super admin access', async () => {
    const created = await createAdmin({
      name: 'Meera Iyer',
      email: 'meera.iyer@fullscan.test',
      role: 'super_admin',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.adminUser.role).toBe('super_admin');

    const cookie = await signIn('meera.iyer@fullscan.test', created.body.data.temporaryPassword);
    expect((await request(app).get(SETTINGS).set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get(ADMIN_USERS).set('Cookie', cookie)).status).toBe(200);
  });

  it('shows the new admin in the list', async () => {
    await createAdmin({ name: 'Listed Admin', email: 'listed.admin@fullscan.test' });
    const list = await request(app).get(ADMIN_USERS).set('Cookie', superAdminCookie);

    expect(list.body.data.map((admin: { email: string }) => admin.email)).toContain(
      'listed.admin@fullscan.test',
    );
  });

  it('refuses an email that is already in use, whatever its case', async () => {
    const before = await countAdminUsers();
    const response = await createAdmin({ name: 'Duplicate', email: SEEDED_REGULAR_ADMIN.email.toUpperCase() });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('An admin with this email already exists');
    expect(await countAdminUsers()).toBe(before);
  });

  it('rejects an invalid email, a too-short name and an unknown role', async () => {
    for (const body of [
      { name: 'No At Sign', email: 'not-an-email' },
      { name: 'X', email: 'short.name@fullscan.test' },
      { name: 'Bad Role', email: 'bad.role@fullscan.test', role: 'owner' },
      { email: 'missing.name@fullscan.test' },
    ]) {
      const response = await createAdmin(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    }
  });

  it('does not let the caller choose the password', async () => {
    const response = await createAdmin({
      name: 'Chosen Password',
      email: 'chosen.password@fullscan.test',
      password: 'Password123!',
    });

    expect(response.status).toBe(400);
  });
});

describe('generateTemporaryPassword', () => {
  it('is 16 characters with every character class and no look-alike characters', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const password = generateTemporaryPassword();

      expect(password).toHaveLength(16);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).toMatch(/[@#$%&*!?]/);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it('does not repeat', () => {
    const passwords = new Set(Array.from({ length: 50 }, generateTemporaryPassword));
    expect(passwords.size).toBe(50);
  });
});

describe('admin sign-in by email', () => {
  it('accepts a seeded admin’s email in place of the username', async () => {
    const response = await request(app)
      .post(LOGIN)
      .send({ username: SEEDED_REGULAR_ADMIN.email, password: SEEDED_REGULAR_ADMIN.password });

    expect(response.status).toBe(200);
    expect(response.body.data.adminUser.id).toBe(SEEDED_REGULAR_ADMIN.id);
  });

  it('gives a wrong password on an email the same generic failure', async () => {
    const response = await request(app)
      .post(LOGIN)
      .send({ username: SEEDED_REGULAR_ADMIN.email, password: 'WrongPassword1!' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid username or password');
  });

  it('still refuses a deactivated admin signing in by email', async () => {
    const response = await request(app)
      .post(LOGIN)
      .send({ username: 'inactive.admin@fullscan.test', password: SEEDED_INACTIVE_ADMIN.password });

    expect(response.status).toBe(403);
  });
});

/* ------------------------------------------------- managing existing admins */

let managedAdminCounter = 0;

/** Adds a fresh admin as the seeded super admin and signs them in. */
async function addSignedInAdmin(role: 'admin' | 'super_admin' = 'admin') {
  managedAdminCounter += 1;
  const email = `managed.${managedAdminCounter}@fullscan.test`;
  const created = await request(app)
    .post(ADMIN_USERS)
    .set('Cookie', superAdminCookie)
    .send({ name: `Managed Admin ${managedAdminCounter}`, email, role });

  const { adminUser, temporaryPassword } = created.body.data;
  const cookie = await signIn(email, temporaryPassword);

  return { id: adminUser.id as string, email, password: temporaryPassword as string, cookie };
}

function patchAdmin(adminUserId: string, body: Record<string, unknown>, cookie = superAdminCookie) {
  return request(app).patch(`${ADMIN_USERS}/${adminUserId}`).set('Cookie', cookie).send(body);
}

function deleteAdmin(adminUserId: string, cookie = superAdminCookie) {
  return request(app).delete(`${ADMIN_USERS}/${adminUserId}`).set('Cookie', cookie);
}

async function findAdminRow(adminUserId: string): Promise<{ role: string; is_active: number } | undefined> {
  const row = await getCollection('admin_users').findOne(
    { _id: adminUserId },
    { projection: { _id: 0, role: 1, is_active: 1 } },
  );
  return (row as { role: string; is_active: number } | null) ?? undefined;
}

describe(`PATCH ${ADMIN_USERS}/:adminUserId — role`, () => {
  it('promotes an existing admin to super admin, effective on their current session', async () => {
    const target = await addSignedInAdmin('admin');
    expect((await request(app).get(SETTINGS).set('Cookie', target.cookie)).status).toBe(403);

    const response = await patchAdmin(target.id, { role: 'super_admin' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: target.id, role: 'super_admin', isActive: true });
    expect((await request(app).get(SETTINGS).set('Cookie', target.cookie)).status).toBe(200);
    expect((await request(app).get(ADMIN_USERS).set('Cookie', target.cookie)).status).toBe(200);
  });

  it('demotes a super admin to admin, effective on their current session', async () => {
    const target = await addSignedInAdmin('super_admin');
    expect((await request(app).get(SETTINGS).set('Cookie', target.cookie)).status).toBe(200);

    const response = await patchAdmin(target.id, { role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('admin');
    expect((await request(app).get(SETTINGS).set('Cookie', target.cookie)).status).toBe(403);
    expect((await request(app).get(CASES).set('Cookie', target.cookie)).status).toBe(200);
  });

  it('lets a promoted super admin manage other admins in turn', async () => {
    const promoted = await addSignedInAdmin('admin');
    const other = await addSignedInAdmin('admin');
    await patchAdmin(promoted.id, { role: 'super_admin' });

    const response = await patchAdmin(other.id, { role: 'super_admin' }, promoted.cookie);
    expect(response.status).toBe(200);
  });
});

describe(`PATCH ${ADMIN_USERS}/:adminUserId — deactivate / reactivate`, () => {
  it('deactivates an admin: their session stops working and they cannot sign in', async () => {
    const target = await addSignedInAdmin('admin');

    const response = await patchAdmin(target.id, { isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);
    expect((await request(app).get('/api/v1/admin/auth/me').set('Cookie', target.cookie)).status).toBe(401);

    const login = await request(app).post(LOGIN).send({ username: target.email, password: target.password });
    expect(login.status).toBe(403);
  });

  it('reactivates a deactivated admin, who can then sign in again', async () => {
    const target = await addSignedInAdmin('admin');
    await patchAdmin(target.id, { isActive: false });

    const response = await patchAdmin(target.id, { isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(true);
    const login = await request(app).post(LOGIN).send({ username: target.email, password: target.password });
    expect(login.status).toBe(200);
  });

  it('applies a role change and a status change in one request', async () => {
    const target = await addSignedInAdmin('super_admin');

    const response = await patchAdmin(target.id, { role: 'admin', isActive: false });

    expect(response.body.data).toMatchObject({ role: 'admin', isActive: false });
    expect(await findAdminRow(target.id)).toEqual({ role: 'admin', is_active: 0 });
  });
});

describe(`PATCH ${ADMIN_USERS}/:adminUserId — refusals`, () => {
  it('is refused to an admin, and to an unauthenticated caller', async () => {
    const target = await addSignedInAdmin('admin');

    expect((await patchAdmin(target.id, { role: 'super_admin' }, adminCookie)).status).toBe(403);
    expect((await request(app).patch(`${ADMIN_USERS}/${target.id}`).send({ isActive: false })).status).toBe(401);
    expect(await findAdminRow(target.id)).toEqual({ role: 'admin', is_active: 1 });
  });

  it('refuses a super admin demoting or deactivating themselves', async () => {
    const demote = await patchAdmin(SEEDED_ADMIN.id, { role: 'admin' });
    const deactivate = await patchAdmin(SEEDED_ADMIN.id, { isActive: false });

    expect(demote.status).toBe(409);
    expect(demote.body.error).toContain('your own');
    expect(deactivate.status).toBe(409);
    expect(await findAdminRow(SEEDED_ADMIN.id)).toEqual({ role: 'super_admin', is_active: 1 });
  });

  it('can never leave the portal without an active super admin', async () => {
    // Two super admins: the first demotes the second, who can then touch no one —
    // and neither can remove themselves.
    const first = await addSignedInAdmin('super_admin');
    const second = await addSignedInAdmin('super_admin');

    expect((await patchAdmin(second.id, { role: 'admin' }, first.cookie)).status).toBe(200);
    expect((await patchAdmin(first.id, { role: 'admin' }, second.cookie)).status).toBe(403);
    expect((await patchAdmin(first.id, { isActive: false }, first.cookie)).status).toBe(409);
    expect(await findAdminRow(first.id)).toEqual({ role: 'super_admin', is_active: 1 });
  });

  it('answers 404 for an unknown admin', async () => {
    expect((await patchAdmin('admin-does-not-exist', { isActive: false })).status).toBe(404);
  });

  it('rejects an empty change, an unknown role, a non-boolean status and other fields', async () => {
    const target = await addSignedInAdmin('admin');

    for (const body of [{}, { role: 'owner' }, { isActive: 'no' }, { email: 'changed@fullscan.test' }]) {
      const response = await patchAdmin(target.id, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(await findAdminRow(target.id)).toEqual({ role: 'admin', is_active: 1 });
  });
});

describe(`DELETE ${ADMIN_USERS}/:adminUserId`, () => {
  it('deletes an admin with no history: gone from the list, session dead, email reusable', async () => {
    const target = await addSignedInAdmin('admin');

    const response = await deleteAdmin(target.id);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: true, id: target.id });
    expect(await findAdminRow(target.id)).toBeUndefined();

    const list = await request(app).get(ADMIN_USERS).set('Cookie', superAdminCookie);
    expect(list.body.data.map((admin: { id: string }) => admin.id)).not.toContain(target.id);

    expect((await request(app).get('/api/v1/admin/auth/me').set('Cookie', target.cookie)).status).toBe(401);
    const login = await request(app).post(LOGIN).send({ username: target.email, password: target.password });
    expect(login.status).toBe(401);

    const recreated = await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', superAdminCookie)
      .send({ name: 'Recreated Admin', email: target.email });
    expect(recreated.status).toBe(201);
  });

  it('refuses to delete an admin who last changed a mobile app setting, and suggests deactivating', async () => {
    const target = await addSignedInAdmin('super_admin');
    await request(app)
      .put(SETTINGS)
      .set('Cookie', target.cookie)
      .send({ settings: [{ key: 'watermark_enabled', value: true }] });

    const response = await deleteAdmin(target.id);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('mobile app setting');
    expect(response.body.error).toContain('Deactivate it instead');
    expect(await findAdminRow(target.id)).toBeDefined();

    // Deactivation is the way out, and it works.
    expect((await patchAdmin(target.id, { isActive: false })).status).toBe(200);
  });

  it('refuses to delete an admin who added other admins', async () => {
    const target = await addSignedInAdmin('super_admin');
    await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', target.cookie)
      .send({ name: 'Added By Target', email: `added.by.${target.id}@fullscan.test` });

    const response = await deleteAdmin(target.id);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('added 1 admin');
  });

  it('refuses a super admin deleting themselves', async () => {
    const response = await deleteAdmin(SEEDED_ADMIN.id);

    expect(response.status).toBe(409);
    expect(await findAdminRow(SEEDED_ADMIN.id)).toBeDefined();
  });

  it('is refused to an admin and to an unauthenticated caller', async () => {
    const target = await addSignedInAdmin('admin');

    expect((await deleteAdmin(target.id, adminCookie)).status).toBe(403);
    expect((await request(app).delete(`${ADMIN_USERS}/${target.id}`)).status).toBe(401);
    expect(await findAdminRow(target.id)).toBeDefined();
  });

  it('answers 404 for an unknown admin', async () => {
    expect((await deleteAdmin('admin-does-not-exist')).status).toBe(404);
  });
});
