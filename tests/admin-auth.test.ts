import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  app,
  extractSessionCookie,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_INACTIVE_ADMIN,
} from './helpers/test-app.js';

afterAll(() => {
  removeTestDb();
});

async function signIn(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

  return extractSessionCookie(response.headers['set-cookie']);
}

describe('POST /api/v1/admin/auth/login', () => {
  it('signs in a seeded admin and returns a token plus profile', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeTypeOf('string');
    expect(response.body.data.adminUser).toMatchObject({
      id: SEEDED_ADMIN.id,
      username: SEEDED_ADMIN.username,
      role: 'super_admin',
    });
  });

  it('never returns the password hash', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(response.body.data.adminUser.passwordHash).toBeUndefined();
  });

  it('sets an httpOnly, SameSite=Strict session cookie', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    const cookie = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith('fs_admin_session='),
    );

    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
  });

  it('issues an admin-scoped token, not a field-executive one', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    const payload = jwt.verify(response.body.data.token, 'test-jwt-secret') as Record<
      string,
      unknown
    >;

    expect(payload.scope).toBe('admin');
    expect(payload.adminUserId).toBe(SEEDED_ADMIN.id);
    expect(payload.fieldExecutiveId).toBeUndefined();
  });

  it('rejects a wrong password with a generic message', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: 'WrongPassword1!' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Invalid username or password' });
  });

  it('gives an unknown username the same response as a wrong password, to prevent enumeration', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'no-such-admin', password: 'WrongPassword1!' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Invalid username or password' });
  });

  it('refuses a deactivated admin account even with correct credentials', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({
        username: SEEDED_INACTIVE_ADMIN.username,
        password: SEEDED_INACTIVE_ADMIN.password,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('deactivated');
  });

  it('rejects a field executive signing in at the admin endpoint', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'fe001', password: 'Password123!' });

    expect(response.status).toBe(401);
  });

  it('rejects a malformed body with a validation error', async () => {
    const response = await request(app).post('/api/v1/admin/auth/login').send({ username: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('GET /api/v1/admin/auth/me', () => {
  it('returns the signed-in admin when given the session cookie', async () => {
    const cookie = await signIn();
    const response = await request(app).get('/api/v1/admin/auth/me').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.username).toBe(SEEDED_ADMIN.username);
    expect(response.body.data.lastLoginAt).toBeTruthy();
  });

  it('accepts the Authorization: Bearer header as an alternative transport', async () => {
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    const response = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(SEEDED_ADMIN.id);
  });

  it('rejects a request with no credentials', async () => {
    const response = await request(app).get('/api/v1/admin/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Missing admin authentication token');
  });

  it('rejects a garbage token', async () => {
    const response = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { adminUserId: SEEDED_ADMIN.id, username: SEEDED_ADMIN.username, role: 'admin', scope: 'admin' },
      'test-jwt-secret',
      { expiresIn: -10 },
    );

    const response = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(response.status).toBe(401);
  });

  it('rejects a token that references an admin who no longer exists', async () => {
    const orphan = jwt.sign(
      { adminUserId: 'admin-does-not-exist', username: 'ghost', role: 'admin', scope: 'admin' },
      'test-jwt-secret',
      { expiresIn: '1h' },
    );

    const response = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${orphan}`);

    expect(response.status).toBe(401);
  });
});

describe('token scope isolation', () => {
  it('rejects a validly-signed field-executive token on an admin route', async () => {
    // Same signing secret, so only the missing `scope: 'admin'` claim stops it.
    const feToken = jwt.sign({ fieldExecutiveId: 'fe-001' }, 'test-jwt-secret', {
      expiresIn: '1h',
    });

    const response = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${feToken}`);

    expect(response.status).toBe(401);
  });

  it('rejects an admin token on a field-executive route', async () => {
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

    const response = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/admin/auth/logout', () => {
  it('expires the session cookie', async () => {
    const cookie = await signIn();
    const response = await request(app).post('/api/v1/admin/auth/logout').set('Cookie', cookie);

    expect(response.status).toBe(200);

    const cleared = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
      value.startsWith('fs_admin_session='),
    );

    expect(cleared).toContain('Max-Age=0');
  });

  it('requires a session to sign out of', async () => {
    const response = await request(app).post('/api/v1/admin/auth/logout');

    expect(response.status).toBe(401);
  });
});
