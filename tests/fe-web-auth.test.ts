import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  app,
  extractSessionCookie,
  getCollection,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
} from './helpers/test-app.js';

const FE_COOKIE = 'fs_fe_session';

afterAll(async () => {
  await removeTestDb();
});

async function signIn(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

  return extractSessionCookie(response.headers['set-cookie'], FE_COOKIE);
}

/** The raw JWT inside a `fs_fe_session=<token>` cookie pair. */
function tokenFromCookie(cookie: string): string {
  return decodeURIComponent(cookie.slice(`${FE_COOKIE}=`.length));
}

async function readDeviceBinding(fieldExecutiveId: string): Promise<{ device_id: string | null }> {
  const row = await getCollection('field_executives')
    .findOne({ _id: fieldExecutiveId }, { projection: { device_id: 1 } });
  return { device_id: (row?.device_id as string | null | undefined) ?? null };
}

describe('POST /api/v1/fe-web/auth/login', () => {
  it('signs in a seeded field executive and returns their profile', async () => {
    const response = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.fieldExecutive).toMatchObject({ id: SEEDED_FIELD_EXECUTIVE.id });
    expect(response.body.data.expiresInSeconds).toBe(8 * 60 * 60);
  });

  it('keeps the token out of the response body and never returns the password hash', async () => {
    const response = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

    expect(response.body.data.token).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('device_id');
  });

  it('sets an httpOnly, SameSite=Strict fs_fe_session cookie, not the admin cookie', async () => {
    const response = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.find((value) => value.startsWith(`${FE_COOKIE}=`));

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=28800');
    expect(cookies.some((value) => value.startsWith('fs_admin_session='))).toBe(false);
  });

  it('issues a web-scoped token', async () => {
    const payload = jwt.verify(tokenFromCookie(await signIn()), 'test-jwt-secret') as Record<
      string,
      unknown
    >;

    expect(payload.scope).toBe('fe_web');
    expect(payload.fieldExecutiveId).toBe(SEEDED_FIELD_EXECUTIVE.id);
  });

  it('does not require a device and leaves the mobile device binding untouched', async () => {
    await getCollection('field_executives')
      .updateOne({ _id: SEEDED_FIELD_EXECUTIVE.id }, { $set: { device_id: 'handset-123' } });

    const response = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

    expect(response.status).toBe(200);
    expect((await readDeviceBinding(SEEDED_FIELD_EXECUTIVE.id)).device_id).toBe('handset-123');

    await getCollection('field_executives')
      .updateOne({ _id: SEEDED_FIELD_EXECUTIVE.id }, { $set: { device_id: null } });
  });

  it('does not bind an unbound account to anything', async () => {
    await signIn();

    expect((await readDeviceBinding(SEEDED_FIELD_EXECUTIVE.id)).device_id).toBeNull();
  });

  it('rejects a wrong password with a generic message', async () => {
    const response = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: 'WrongPassword1!' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Invalid username or password' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('gives an unknown username the same response as a wrong password', async () => {
    const response = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: 'no-such-fe', password: 'WrongPassword1!' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Invalid username or password' });
  });

  it('rejects admin credentials', async () => {
    const response = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    expect(response.status).toBe(401);
  });

  it('rejects a malformed body with a validation error', async () => {
    const response = await request(app).post('/api/v1/fe-web/auth/login').send({ username: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('GET /api/v1/fe-web/auth/me', () => {
  it('returns the signed-in field executive for the session cookie', async () => {
    const response = await request(app).get('/api/v1/fe-web/auth/me').set('Cookie', await signIn());

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: SEEDED_FIELD_EXECUTIVE.id });
    expect(response.body.data.name).toBeTypeOf('string');
  });

  it('rejects a request with no session', async () => {
    const response = await request(app).get('/api/v1/fe-web/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Missing field executive web session');
  });

  it('does not accept the web token as a Bearer header', async () => {
    const response = await request(app)
      .get('/api/v1/fe-web/auth/me')
      .set('Authorization', `Bearer ${tokenFromCookie(await signIn())}`);

    expect(response.status).toBe(401);
  });

  it('rejects an expired web token', async () => {
    const expired = jwt.sign(
      { fieldExecutiveId: SEEDED_FIELD_EXECUTIVE.id, scope: 'fe_web' },
      'test-jwt-secret',
      { expiresIn: -10 },
    );

    const response = await request(app)
      .get('/api/v1/fe-web/auth/me')
      .set('Cookie', `${FE_COOKIE}=${expired}`);

    expect(response.status).toBe(401);
  });

  it('rejects a web token for a field executive who no longer exists', async () => {
    const orphan = jwt.sign({ fieldExecutiveId: 'fe-ghost', scope: 'fe_web' }, 'test-jwt-secret', {
      expiresIn: '1h',
    });

    const response = await request(app)
      .get('/api/v1/fe-web/auth/me')
      .set('Cookie', `${FE_COOKIE}=${orphan}`);

    expect(response.status).toBe(401);
  });
});

describe('token scope isolation', () => {
  it('rejects a mobile field-executive token in the web session cookie', async () => {
    const mobileToken = jwt.sign({ fieldExecutiveId: SEEDED_FIELD_EXECUTIVE.id }, 'test-jwt-secret', {
      expiresIn: '1h',
    });

    const response = await request(app)
      .get('/api/v1/fe-web/auth/me')
      .set('Cookie', `${FE_COOKIE}=${mobileToken}`);

    expect(response.status).toBe(401);
  });

  it('rejects an admin token in the web session cookie', async () => {
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    const response = await request(app)
      .get('/api/v1/fe-web/auth/me')
      .set('Cookie', `${FE_COOKIE}=${login.body.data.token}`);

    expect(response.status).toBe(401);
  });

  it('rejects a web token on the device-bound mobile API', async () => {
    const response = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenFromCookie(await signIn())}`);

    expect(response.status).toBe(401);
  });

  it('rejects a web token on the admin API', async () => {
    const response = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${tokenFromCookie(await signIn())}`);

    expect(response.status).toBe(401);
  });

  it('still accepts a mobile token on the mobile API', async () => {
    const mobileToken = jwt.sign({ fieldExecutiveId: SEEDED_FIELD_EXECUTIVE.id }, 'test-jwt-secret', {
      expiresIn: '1h',
    });

    const response = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${mobileToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(SEEDED_FIELD_EXECUTIVE.id);
  });
});

describe('POST /api/v1/fe-web/auth/logout', () => {
  it('expires the session cookie', async () => {
    const response = await request(app).post('/api/v1/fe-web/auth/logout').set('Cookie', await signIn());

    expect(response.status).toBe(200);

    const cleared = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith(`${FE_COOKIE}=`),
    );

    expect(cleared).toContain('Max-Age=0');
  });

  it('requires a session to sign out of', async () => {
    const response = await request(app).post('/api/v1/fe-web/auth/logout');

    expect(response.status).toBe(401);
  });
});
