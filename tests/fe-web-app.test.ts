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
  testDbDir,
} from './helpers/test-app.js';

const appDir = path.join(testDbDir, 'web-fe-dist');
const SHELL_MARKER = '<div id="root"></div>';

beforeAll(() => {
  fs.mkdirSync(path.join(appDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(appDir, 'index.html'), `<!doctype html><html><body>${SHELL_MARKER}</body></html>`);
  fs.writeFileSync(path.join(appDir, 'assets', 'index-abc123.js'), 'export {};');
  process.env.FE_WEB_APP_DIR = appDir;
});

afterAll(async () => {
  delete process.env.FE_WEB_APP_DIR;
  await removeTestDb();
});

async function signIn(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/fe-web/auth/login')
    .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password });

  return extractSessionCookie(response.headers['set-cookie'], 'fs_fe_session');
}

describe('Field executive React app at /app', () => {
  it('redirects an anonymous browser to /app/login, carrying next', async () => {
    const response = await request(app).get('/app/assignments/abc');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`/app/login?next=${encodeURIComponent('/app/assignments/abc')}`);
    expect(response.text).not.toContain(SHELL_MARKER);
  });

  it('serves the login page anonymously, uncached', async () => {
    const response = await request(app).get('/app/login');

    expect(response.status).toBe(200);
    expect(response.text).toContain(SHELL_MARKER);
    expect(response.headers['cache-control']).toBe('no-store, must-revalidate');
  });

  it('bounces a signed-in executive away from the login page', async () => {
    const response = await request(app).get('/app/login').set('Cookie', await signIn());

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/app');
  });

  it('serves the shell for any page path to a signed-in executive', async () => {
    const cookie = await signIn();

    for (const pagePath of ['/app', '/app/assignments', '/app/assignments/some-id']) {
      const response = await request(app).get(pagePath).set('Cookie', cookie);
      expect(response.status, pagePath).toBe(200);
      expect(response.text, pagePath).toContain(SHELL_MARKER);
    }
  });

  it('does not open the app for an admin session', async () => {
    const login = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: SEEDED_ADMIN.password });
    const adminCookie = extractSessionCookie(login.headers['set-cookie']);

    const response = await request(app).get('/app').set('Cookie', adminCookie);

    expect(response.status).toBe(302);
  });

  it('serves build assets without a session and 404s missing ones', async () => {
    const asset = await request(app).get('/app/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');

    const missing = await request(app).get('/app/assets/nope.js');
    expect(missing.status).toBe(404);
  });

  it('applies the portal CSP', async () => {
    const response = await request(app).get('/app/login');

    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('answers 503 when the app has not been built', async () => {
    process.env.FE_WEB_APP_DIR = path.join(testDbDir, 'missing-build');
    try {
      const response = await request(app).get('/app/login');
      expect(response.status).toBe(503);
    } finally {
      process.env.FE_WEB_APP_DIR = appDir;
    }
  });
});
