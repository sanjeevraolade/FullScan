import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Migration `015` tightens the geo-fence radius from 25..5000 to 10..2000. A
 * database written under the old bounds can hold a value the admin form would
 * now refuse, so the migration clamps it. This suite reproduces that upgrade on
 * a fresh database rather than trusting the seed defaults.
 *
 * Runs its own `better-sqlite3` connection so it can apply migrations in two
 * stages — the shared `test-app` helper applies them all at once.
 */

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');
const MIGRATION_014 = '014_create_mobile_app_settings.sql';
const MIGRATION_015 = '015_add_location_retry_and_tighten_geofence.sql';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fullscan-migration-test-'));

interface SettingRow {
  readonly setting_value: string;
  readonly min_value: number | null;
  readonly max_value: number | null;
}

async function openDatabase(fileName: string) {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(path.join(testDir, fileName));
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Applies `*.sql` in filename order up to and including `throughMigration`,
 * skipping anything already applied to this database — the same
 * apply-once-in-order contract `initDb()` implements, so a suite can stop at one
 * migration, change data, and then apply the next.
 */
function createMigrator(db: { exec: (sql: string) => unknown }) {
  const applied = new Set<string>();

  return function applyThrough(throughMigration: string): void {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .filter((file) => file <= throughMigration && !applied.has(file));

    for (const file of files) {
      db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8'));
      applied.add(file);
    }
  };
}

function readSetting(
  db: { prepare: (sql: string) => { get: (key: string) => unknown } },
  key: string,
): SettingRow {
  return db
    .prepare(
      'SELECT setting_value, min_value, max_value FROM mobile_app_settings WHERE setting_key = ?',
    )
    .get(key) as SettingRow;
}

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('migration 015 — location retry + tightened geo-fence', () => {
  it('adds locationRetryCount with a default of 3 and a 3-10 range', async () => {
    const db = await openDatabase('add.sqlite');
    createMigrator(db)(MIGRATION_015);

    const row = readSetting(db, 'locationRetryCount');
    expect(row.setting_value).toBe('3');
    expect(row.min_value).toBe(3);
    expect(row.max_value).toBe(10);

    db.close();
  });

  it('narrows the geo-fence bounds from 25..5000 to 10..2000', async () => {
    const db = await openDatabase('bounds.sqlite');
    const applyThrough = createMigrator(db);

    applyThrough(MIGRATION_014);
    const before = readSetting(db, 'geo_fence_radius_meters');
    expect([before.min_value, before.max_value]).toEqual([25, 5000]);

    applyThrough(MIGRATION_015);
    const after = readSetting(db, 'geo_fence_radius_meters');
    expect([after.min_value, after.max_value]).toEqual([10, 2000]);

    db.close();
  });

  it('clamps a stored radius that the old, wider bounds had allowed', async () => {
    const db = await openDatabase('clamp-high.sqlite');
    const applyThrough = createMigrator(db);

    applyThrough(MIGRATION_014);
    // 4500 was legal at 25..5000.
    db.prepare(
      "UPDATE mobile_app_settings SET setting_value = '4500' WHERE setting_key = 'geo_fence_radius_meters'",
    ).run();

    applyThrough(MIGRATION_015);

    expect(readSetting(db, 'geo_fence_radius_meters').setting_value).toBe('2000');
    db.close();
  });

  it('clamps a stored radius below the new 10m minimum', async () => {
    const db = await openDatabase('clamp-low.sqlite');
    const applyThrough = createMigrator(db);

    applyThrough(MIGRATION_014);
    db.prepare(
      "UPDATE mobile_app_settings SET setting_value = '4' WHERE setting_key = 'geo_fence_radius_meters'",
    ).run();

    applyThrough(MIGRATION_015);

    expect(readSetting(db, 'geo_fence_radius_meters').setting_value).toBe('10');
    db.close();
  });

  it('leaves an in-range radius untouched', async () => {
    const db = await openDatabase('in-range.sqlite');
    const applyThrough = createMigrator(db);

    applyThrough(MIGRATION_014);
    db.prepare(
      "UPDATE mobile_app_settings SET setting_value = '425' WHERE setting_key = 'geo_fence_radius_meters'",
    ).run();

    applyThrough(MIGRATION_015);

    expect(readSetting(db, 'geo_fence_radius_meters').setting_value).toBe('425');
    db.close();
  });

  it('does not reset an admin-saved retry count if the migration is replayed', async () => {
    const db = await openDatabase('idempotent.sqlite');
    createMigrator(db)(MIGRATION_015);

    expect(readSetting(db, 'locationRetryCount').setting_value).toBe('3');

    db.prepare(
      "UPDATE mobile_app_settings SET setting_value = '8' WHERE setting_key = 'locationRetryCount'",
    ).run();

    // Re-execute just 015's SQL, as a double-applied migration would.
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_015), 'utf-8'));

    // INSERT OR IGNORE must not pull the saved value back to the seed.
    expect(readSetting(db, 'locationRetryCount').setting_value).toBe('8');

    db.close();
  });
});
