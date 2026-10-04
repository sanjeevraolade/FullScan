import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Db } from 'mongodb';
import {
  app,
  extractSessionCookie,
  getCollection,
  getDb,
  removeTestDb,
  SEEDED_ADMIN,
  SEEDED_FIELD_EXECUTIVE,
  SEEDED_REGULAR_ADMIN,
} from './helpers/test-app.js';
import { MIGRATIONS, recordMigrationsApplied, runMigrations } from '../src/db/migrations/index.js';
import { applySchema } from '../src/db/schema.js';
import { MASTER_DATA_METADATA_ID, type AppMetadataDocument } from '../src/types/app-metadata.types.js';

/**
 * The master-data version (docs/api-contracts/master-data-sync.md at the monorepo
 * root): one `app_metadata` document whose `updated_at` changes whenever master data
 * changes. Login returns it as `masterDataUpdatedAt` and `GET /master-data` as
 * `updatedAt`; the app re-downloads master data only when the two differ.
 *
 * Covers what it looks like, when it changes (a saved settings batch, in the same
 * transaction) and when it must not (rejected or refused saves, plain reads), the
 * missing-document case, and the migration that creates it.
 */

const LOGIN = '/api/v1/auth/login';
const MASTER_DATA = '/api/v1/master-data';
const ADMIN_LOGIN = '/api/v1/admin/auth/login';
const ADMIN_SETTINGS = '/api/v1/admin/mobile-app-settings';

/** ISO 8601 UTC with milliseconds, e.g. `2026-10-04T09:15:02.481Z`. */
const ISO_WITH_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const HANDSET = {
  deviceId: 'master-data-version-handset-01',
  deviceDetails: {
    deviceName: 'Pixel 8',
    model: 'Pixel 8',
    brand: 'google',
    osVersion: '15',
    appVersion: '1.0',
    systemName: 'Android',
    uniqueId: 'master-data-version-handset-01',
  },
};

type SettingValue = boolean | number | string;

let superAdminCookie: string;
let regularAdminCookie: string;

async function adminCookie(account: { username: string; password: string }): Promise<string> {
  const response = await request(app)
    .post(ADMIN_LOGIN)
    .send({ username: account.username, password: account.password });
  return extractSessionCookie(response.headers['set-cookie']);
}

function appMetadata() {
  return getCollection<AppMetadataDocument>('app_metadata');
}

/** What the database holds right now, bypassing the API. */
async function storedVersion(): Promise<string | null> {
  const document = await appMetadata().findOne({ _id: MASTER_DATA_METADATA_ID });
  return document?.updated_at ?? null;
}

async function masterDataVersion(): Promise<string | null> {
  const response = await request(app).get(MASTER_DATA);
  expect(response.status).toBe(200);
  return response.body.data.updatedAt;
}

async function loginVersion(): Promise<string | null> {
  const response = await request(app)
    .post(LOGIN)
    .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password, ...HANDSET });
  expect(response.status).toBe(200);
  return response.body.data.masterDataUpdatedAt;
}

function saveSettings(settings: ReadonlyArray<{ key: string; value: SettingValue }>, cookie = superAdminCookie) {
  return request(app).put(ADMIN_SETTINGS).set('Cookie', cookie).send({ settings });
}

async function readSettingValue(key: string): Promise<SettingValue | undefined> {
  const response = await request(app).get(ADMIN_SETTINGS).set('Cookie', superAdminCookie);
  expect(response.status).toBe(200);
  return (response.body.data as Array<{ key: string; value: SettingValue }>).find((setting) => setting.key === key)
    ?.value;
}

beforeAll(async () => {
  superAdminCookie = await adminCookie(SEEDED_ADMIN);
  regularAdminCookie = await adminCookie(SEEDED_REGULAR_ADMIN);
});

afterAll(async () => {
  await removeTestDb();
});

describe('the master-data version', () => {
  it('is served by GET /master-data as a top-level ISO 8601 UTC timestamp with milliseconds', async () => {
    const response = await request(app).get(MASTER_DATA);

    expect(response.status).toBe(200);
    expect(response.body.data.updatedAt).toMatch(ISO_WITH_MILLISECONDS);
    expect(response.body.data.updatedAt).toBe(await storedVersion());
  });

  it('leaves the rest of the payload as it was, including the settings-only mobileAppSettings.updatedAt', async () => {
    const { data } = (await request(app).get(MASTER_DATA)).body;

    expect(Object.keys(data).sort()).toEqual([
      'actionStatuses',
      'componentStatuses',
      'insuffOptions',
      'mobileAppSettings',
      'photoTypes',
      'profileStatuses',
      'updatedAt',
      'utvOptions',
      'verificationTypeStatuses',
    ]);
    expect(data.verificationTypeStatuses.length).toBeGreaterThan(0);
    // Still the stored `YYYY-MM-DD HH:MM:SS` settings timestamp, not the version.
    expect(data.mobileAppSettings.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('is the value login returns as masterDataUpdatedAt', async () => {
    const fromLogin = await loginVersion();

    expect(fromLogin).toMatch(ISO_WITH_MILLISECONDS);
    expect(fromLogin).toBe(await masterDataVersion());
  });

  it('does not change when it is read', async () => {
    const before = await storedVersion();

    await masterDataVersion();
    await loginVersion();
    await masterDataVersion();

    expect(await storedVersion()).toBe(before);
  });
});

describe(`PUT ${ADMIN_SETTINGS}`, () => {
  it('bumps it on a successful save, and both login and /master-data report the new value', async () => {
    const before = await masterDataVersion();

    const response = await saveSettings([{ key: 'geo_fence_radius_meters', value: 350 }]);
    expect(response.status).toBe(200);

    const after = await masterDataVersion();
    expect(after).toMatch(ISO_WITH_MILLISECONDS);
    expect(after).not.toBe(before);
    expect(await loginVersion()).toBe(after);
    expect(await storedVersion()).toBe(after);
  });

  it('bumps it on every save, even one that leaves each value as it was', async () => {
    expect((await saveSettings([{ key: 'geo_fence_radius_meters', value: 350 }])).status).toBe(200);
    const first = await masterDataVersion();

    expect((await saveSettings([{ key: 'geo_fence_radius_meters', value: 350 }])).status).toBe(200);
    const second = await masterDataVersion();

    expect(second).toMatch(ISO_WITH_MILLISECONDS);
    expect(second).not.toBe(first);
  });

  it('leaves it unchanged when the batch names an unknown setting', async () => {
    const before = await storedVersion();

    const response = await saveSettings([{ key: 'no_such_setting', value: true }]);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Unknown setting: no_such_setting');
    expect(await storedVersion()).toBe(before);
    expect(await loginVersion()).toBe(before);
  });

  it('leaves it unchanged when one value is out of range, valid entries in the batch included', async () => {
    const before = await storedVersion();

    const response = await saveSettings([
      { key: 'geo_fence_radius_meters', value: 640 },
      { key: 'photo_compression_quality', value: 500 },
    ]);

    expect(response.status).toBe(400);
    expect(await storedVersion()).toBe(before);
    expect(await masterDataVersion()).toBe(before);
    expect(await readSettingValue('geo_fence_radius_meters')).not.toBe(640);
  });

  it('leaves it unchanged when the body fails request validation', async () => {
    const before = await storedVersion();

    const response = await request(app).put(ADMIN_SETTINGS).set('Cookie', superAdminCookie).send({ settings: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(await storedVersion()).toBe(before);
  });

  it('leaves it unchanged when the caller has no admin session (401)', async () => {
    const before = await storedVersion();

    const response = await request(app)
      .put(ADMIN_SETTINGS)
      .send({ settings: [{ key: 'geo_fence_radius_meters', value: 640 }] });

    expect(response.status).toBe(401);
    expect(await storedVersion()).toBe(before);
  });

  it('leaves it unchanged when a regular admin tries to save (403, super admin only)', async () => {
    const before = await storedVersion();

    const response = await saveSettings([{ key: 'geo_fence_radius_meters', value: 640 }], regularAdminCookie);

    expect(response.status).toBe(403);
    expect(await storedVersion()).toBe(before);
  });

  it('commits in the same transaction as the settings: if the bump fails, the settings roll back too', async () => {
    const before = await storedVersion();
    const radiusBefore = await readSettingValue('geo_fence_radius_meters');
    expect(radiusBefore).not.toBe(777);

    // Make every write to app_metadata fail, so the bump — which runs after the
    // settings bulkWrite — throws inside the transaction.
    await getDb().command({
      collMod: 'app_metadata',
      validator: { $jsonSchema: { required: ['field_that_is_never_written'] } },
      validationLevel: 'strict',
      validationAction: 'error',
    });

    try {
      const response = await saveSettings([{ key: 'geo_fence_radius_meters', value: 777 }]);
      expect(response.status).toBe(500);
    } finally {
      await applySchema(getDb());
    }

    expect(await readSettingValue('geo_fence_radius_meters')).toBe(radiusBefore);
    expect(await storedVersion()).toBe(before);
  });
});

describe('with no version recorded', () => {
  beforeAll(async () => {
    await appMetadata().deleteOne({ _id: MASTER_DATA_METADATA_ID });
  });

  it('serves updatedAt: null on /master-data, with the rest of the payload intact', async () => {
    const response = await request(app).get(MASTER_DATA);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('updatedAt', null);
    expect(response.body.data.verificationTypeStatuses.length).toBeGreaterThan(0);
    expect(response.body.data.mobileAppSettings.values).toHaveProperty('geo_fence_radius_meters');
  });

  it('returns masterDataUpdatedAt: null from login', async () => {
    const response = await request(app)
      .post(LOGIN)
      .send({ username: SEEDED_FIELD_EXECUTIVE.username, password: SEEDED_FIELD_EXECUTIVE.password, ...HANDSET });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('masterDataUpdatedAt', null);
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it('does not create one on read', async () => {
    await masterDataVersion();
    await loginVersion();

    expect(await appMetadata().countDocuments({ _id: MASTER_DATA_METADATA_ID })).toBe(0);
  });

  it('records one again on the next successful settings save', async () => {
    expect((await saveSettings([{ key: 'geo_fence_radius_meters', value: 360 }])).status).toBe(200);

    const recorded = await storedVersion();
    expect(recorded).toMatch(ISO_WITH_MILLISECONDS);
    expect(await masterDataVersion()).toBe(recorded);
    expect(await loginVersion()).toBe(recorded);
  });
});

describe('migration 002_init_master_data_version', () => {
  const scratchDbs: Db[] = [];

  /** An empty database on the same replica set, dropped after the suite. */
  async function emptyDatabase(suffix: string): Promise<Db> {
    const db = getDb().client.db(`${getDb().databaseName}_${suffix}`);
    await db.dropDatabase();
    scratchDbs.push(db);
    return db;
  }

  async function versionIn(db: Db): Promise<string | null> {
    const document = await db.collection<AppMetadataDocument>('app_metadata').findOne({ _id: MASTER_DATA_METADATA_ID });
    return document?.updated_at ?? null;
  }

  afterAll(async () => {
    for (const db of scratchDbs) {
      await db.dropDatabase();
    }
  });

  it('runs right after the seed migration', () => {
    expect(MIGRATIONS.slice(0, 2).map((migration) => migration.name)).toEqual([
      '001_seed_initial_data',
      '002_init_master_data_version',
    ]);
  });

  it('records a version on a fresh database, after 001 has seeded it', async () => {
    const db = await emptyDatabase('fresh');

    await applySchema(db);
    await runMigrations(getDb().client, db);

    expect(await versionIn(db)).toMatch(ISO_WITH_MILLISECONDS);
    expect(await db.collection('dropdown_options').countDocuments()).toBeGreaterThan(0);
    expect(
      await db.collection<{ _id: string }>('migrations').countDocuments({ _id: '002_init_master_data_version' }),
    ).toBe(1);
  });

  it('gives a database that applied 001 before 002 existed a version, without reseeding it', async () => {
    const db = await emptyDatabase('existing');

    await applySchema(db);
    await recordMigrationsApplied(db, ['001_seed_initial_data']);
    await runMigrations(getDb().client, db);

    expect(await versionIn(db)).toMatch(ISO_WITH_MILLISECONDS);
    expect(await db.collection('dropdown_options').countDocuments()).toBe(0);
  });

  it('runs once: a restart leaves the recorded version alone', async () => {
    const db = await emptyDatabase('restart');

    await applySchema(db);
    await runMigrations(getDb().client, db);
    const first = await versionIn(db);

    await applySchema(db);
    await runMigrations(getDb().client, db);

    expect(first).toMatch(ISO_WITH_MILLISECONDS);
    expect(await versionIn(db)).toBe(first);
  });
});
