import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  extractSessionCookie,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
} from './helpers/test-app.js';

afterAll(async () => {
  await removeTestDb();
});

async function signIn(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

async function signInAdmin(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

  return extractSessionCookie(response.headers['set-cookie']);
}

describe('field executive portal page guard', () => {
  it('redirects an anonymous visitor from the portal root to the login page', async () => {
    const response = await request(app).get('/fe');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/fe/login?next=%2Ffe');
  });

  it('never sends the shell HTML to an anonymous visitor', async () => {
    const response = await request(app).get('/fe');

    expect(response.text).not.toContain('data-logout');
  });

  it('redirects when the session cookie holds an invalid token', async () => {
    const response = await request(app).get('/fe').set('Cookie', 'fs_fe_session=forged');

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/fe/login');
  });

  it('serves the drawer shell to a signed-in field executive, uncached', async () => {
    const response = await request(app).get('/fe').set('Cookie', await signIn());

    expect(response.status).toBe(200);
    expect(response.text).toContain('data-drawer-nav');
    expect(response.text).toContain('data-logout');
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('does not let an admin session open the field executive portal', async () => {
    const response = await request(app).get('/fe').set('Cookie', await signInAdmin());

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/fe/login');
  });

  it('does not let a field executive session open the admin portal', async () => {
    const response = await request(app).get('/admin').set('Cookie', await signIn());

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/admin/login');
  });
});

describe('field executive login page', () => {
  it('is reachable without a session', async () => {
    const response = await request(app).get('/fe/login');

    expect(response.status).toBe(200);
    expect(response.text).toContain('data-login-form');
  });

  it('bounces an already-signed-in field executive to the portal', async () => {
    const response = await request(app).get('/fe/login').set('Cookie', await signIn());

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/fe');
  });
});

describe('field executive portal assets', () => {
  it('serves its own modules and stylesheet, plus the shared admin ones it loads, without a session', async () => {
    for (const asset of [
      '/fe/assets/css/fe.css',
      '/fe/assets/js/api.js',
      '/fe/assets/js/app.js',
      '/fe/assets/js/login.js',
      '/fe/assets/js/menu.js',
      '/fe/assets/js/pages/profile.js',
      '/fe/assets/js/pages/cases.js',
      '/admin/assets/css/admin.css',
      '/admin/assets/js/dom.js',
      '/admin/assets/js/drawer.js',
      '/admin/assets/js/router.js',
      '/admin/assets/js/icons.js',
      '/admin/assets/js/device-change.js',
    ]) {
      const response = await request(app).get(asset);
      expect(response.status, `${asset} should be served`).toBe(200);
    }
  });

  it('404s an asset that does not exist instead of falling through to the shell', async () => {
    const response = await request(app).get('/fe/assets/js/nope.js');

    expect(response.status).toBe(404);
  });

  it('applies the portal Content-Security-Policy', async () => {
    const response = await request(app).get('/fe/login');
    const csp = response.headers['content-security-policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
