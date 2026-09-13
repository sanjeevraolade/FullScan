import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, extractSessionCookie, removeTestDb, SEEDED_ADMIN } from './helpers/test-app.js';

afterAll(() => {
  removeTestDb();
});

async function signIn(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });

  return extractSessionCookie(response.headers['set-cookie']);
}

describe('admin portal page guard', () => {
  it('redirects an anonymous visitor from the portal root to the login page', async () => {
    const response = await request(app).get('/admin');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin/login?next=%2Fadmin');
  });

  it('redirects an anonymous visitor from a deep portal path, preserving the destination', async () => {
    const response = await request(app).get('/admin/mobile-app-settings');

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('%2Fadmin%2Fmobile-app-settings');
  });

  it('never sends the shell HTML to an anonymous visitor', async () => {
    const response = await request(app).get('/admin');

    expect(response.text).not.toContain('data-drawer-nav');
  });

  it('redirects when the session cookie holds an invalid token', async () => {
    const response = await request(app).get('/admin').set('Cookie', 'fs_admin_session=forged');

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/admin/login');
  });

  it('serves the shell to a signed-in admin', async () => {
    const cookie = await signIn();
    const response = await request(app).get('/admin').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.text).toContain('data-drawer-nav');
    expect(response.text).toContain('data-logout');
  });

  it('tells browsers not to cache portal pages', async () => {
    const cookie = await signIn();
    const response = await request(app).get('/admin').set('Cookie', cookie);

    expect(response.headers['cache-control']).toContain('no-store');
  });
});

describe('admin login page', () => {
  it('is reachable without a session', async () => {
    const response = await request(app).get('/admin/login');

    expect(response.status).toBe(200);
    expect(response.text).toContain('data-login-form');
  });

  it('bounces an already-signed-in admin to the portal', async () => {
    const cookie = await signIn();
    const response = await request(app).get('/admin/login').set('Cookie', cookie);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin');
  });
});

describe('admin portal assets', () => {
  it('serves the stylesheet without requiring a session', async () => {
    const response = await request(app).get('/admin/assets/css/admin.css');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/css');
  });

  it('serves the ES modules the shell loads', async () => {
    for (const asset of [
      '/admin/assets/js/app.js',
      '/admin/assets/js/menu.js',
      '/admin/assets/js/drawer.js',
      '/admin/assets/js/router.js',
      '/admin/assets/js/api.js',
      '/admin/assets/js/dom.js',
      '/admin/assets/js/icons.js',
      '/admin/assets/js/login.js',
      '/admin/assets/js/pages/mobile-app-settings.js',
      '/admin/assets/js/pages/cases.js',
      '/admin/assets/js/pages/field-executive-history.js',
    ]) {
      const response = await request(app).get(asset);
      expect(response.status, `${asset} should be served`).toBe(200);
    }
  });

  it('404s an asset that does not exist instead of falling through to the shell', async () => {
    const response = await request(app).get('/admin/assets/js/nope.js');

    expect(response.status).toBe(404);
  });

  it('applies a portal-scoped Content-Security-Policy', async () => {
    const response = await request(app).get('/admin/login');
    const csp = response.headers['content-security-policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
