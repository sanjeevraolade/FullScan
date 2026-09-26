import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, removeTestDb, SEEDED_ADMIN } from './helpers/test-app.js';

/**
 * Isolated in its own file on purpose: the rate limiter's store is per-process,
 * so exhausting the window here must not starve the other admin suites.
 */

afterAll(async () => {
  await removeTestDb();
});

describe('admin login rate limiting', () => {
  it('blocks further attempts once the failure limit is reached', async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ username: SEEDED_ADMIN.username, password: `wrong-${attempt}` });

      statuses.push(response.status);
    }

    expect(statuses.filter((status) => status === 401).length).toBe(10);
    expect(statuses.filter((status) => status === 429).length).toBe(2);
  });

  it('reports the throttle as a normal API error envelope', async () => {
    const response = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: SEEDED_ADMIN.username, password: 'still-wrong' });

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ success: false });
    expect(response.body.error).toContain('Too many sign-in attempts');
  });
});
