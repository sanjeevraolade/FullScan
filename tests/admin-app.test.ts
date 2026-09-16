import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  extractSessionCookie,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
  SEEDED_REGULAR_ADMIN,
  testDbDir,
} from './helpers/test-app.js';

const appDir = path.join(testDbDir, 'web-admin-dist');
const SHELL_MARKER = '<div id="root" data-admin></div>';

beforeAll(() => {
  fs.mkdirSync(path.join(appDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(appDir, 'index.html'), `<!doctype html><html><body>${SHELL_MARKER}</body></html>`);
  fs.writeFileSync(path.join(appDir, 'assets', 'index-xyz789.js'), 'export {};');
  process.env.ADMIN_APP_DIR = appDir;
});

afterAll(() => {
  delete process.env.ADMIN_APP_DIR;
  removeTestDb();
});

async function signInAdmin(account: { username: string; password: string } = SEEDED_ADMIN): Promise<string> {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ username: account.username, password: account.password });

  return extractSessionCookie(response.headers['set-cookie']);
}

describe('Admin React app at /admin-app', () => {
  it('redirects an anonymous browser to /admin-app/login, carrying next', async () => {
    const response = await request(app).get('/admin-app/cases/case-0001');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`/admin-app/login?next=${encodeURIComponent('/admin-app/cases/case-0001')}`);
    expect(response.text).not.toContain(SHELL_MARKER);
  });

  it('serves the login page anonymously, uncached', async () => {
    const response = await request(app).get('/admin-app/login');

    expect(response.status).toBe(200);
    expect(response.text).toContain(SHELL_MARKER);
    expect(response.headers['cache-control']).toBe('no-store, must-revalidate');
  });

  it('bounces a signed-in admin away from the login page', async () => {
    const response = await request(app).get('/admin-app/login').set('Cookie', await signInAdmin());

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin-app');
  });

  it('serves the shell for any page path to both admin roles', async () => {
    for (const account of [SEEDED_ADMIN, SEEDED_REGULAR_ADMIN]) {
      const cookie = await signInAdmin(account);
      for (const pagePath of ['/admin-app', '/admin-app/cases', '/admin-app/mobile-app-settings']) {
        const response = await request(app).get(pagePath).set('Cookie', cookie);
        expect(response.status, `${account.username} ${pagePath}`).toBe(200);
        expect(response.text).toContain(SHELL_MARKER);
      }
    }
  });

  it('does not open for a field executive web session', async () => {
    const login = await request(app)
      .post('/api/v1/fe-web/auth/login')
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });
    const feCookie = extractSessionCookie(login.headers['set-cookie'], 'fs_fe_session');

    const response = await request(app).get('/admin-app').set('Cookie', feCookie);

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/admin-app/login');
  });

  it('does not interfere with the static /admin portal', async () => {
    const response = await request(app).get('/admin/login');

    expect(response.status).toBe(200);
    expect(response.text).not.toContain(SHELL_MARKER);
  });

  it('serves build assets without a session and 404s missing ones', async () => {
    const asset = await request(app).get('/admin-app/assets/index-xyz789.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');

    expect((await request(app).get('/admin-app/assets/nope.js')).status).toBe(404);
  });

  it('applies the portal CSP', async () => {
    const response = await request(app).get('/admin-app/login');

    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('answers 503 when the app has not been built', async () => {
    process.env.ADMIN_APP_DIR = path.join(testDbDir, 'missing-admin-build');
    try {
      const response = await request(app).get('/admin-app/login');
      expect(response.status).toBe(503);
      expect(response.body.error).toContain('build:admin-web');
    } finally {
      process.env.ADMIN_APP_DIR = appDir;
    }
  });
});
