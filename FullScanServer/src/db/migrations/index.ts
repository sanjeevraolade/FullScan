import type { ClientSession, Db, MongoClient } from 'mongodb';
import { logger } from '../../utils/logger.js';
import { MIGRATIONS_COLLECTION } from '../schema.js';
import { nowTimestamp } from '../timestamp.js';
import { seedInitialData } from './001_seed_initial_data.js';
import { initMasterDataVersion } from './002_init_master_data_version.js';

/**
 * Data migrations, applied once each, in array order, and recorded in the
 * `migrations` collection. Collections, validators and indexes are not migrations —
 * `applySchema()` converges those on every startup.
 *
 * To change data: append a new migration. Never edit one that has shipped; a
 * database that already applied it will not run it again.
 */
export interface Migration {
  readonly name: string;
  /** Every operation must pass `session` — the migration and its record commit together. */
  up(db: Db, session: ClientSession): Promise<void>;
}

/**
 * **Master-data rule.** A migration that inserts, updates or deletes `dropdown_options`
 * or `mobile_app_settings` rows must also call `bumpMasterDataVersion(db, session)`
 * (`master-data-version.ts`) in that migration. So must a server change to the
 * `GET /master-data` payload shape: ship it with a new migration that bumps the version.
 * The mobile app re-downloads master data only when the version it gets at login
 * differs from its cached copy's, so a change without a bump never reaches devices
 * that already have a copy.
 */
export const MIGRATIONS: readonly Migration[] = [seedInitialData, initMasterDataVersion];

interface MigrationRecord {
  readonly _id: string;
  readonly applied_at: string;
}

export async function runMigrations(client: MongoClient, db: Db): Promise<void> {
  const records = db.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
  const applied = new Set((await records.find({}, { projection: { _id: 1 } }).toArray()).map((record) => record._id));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) {
      continue;
    }

    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        await migration.up(db, session);
        await records.insertOne({ _id: migration.name, applied_at: nowTimestamp() }, { session });
      });
    } finally {
      await session.endSession();
    }

    logger.info(`Migration applied: ${migration.name}`);
  }
}

/** Marks migrations as applied without running them — used after copying a SQLite database in. */
export async function recordMigrationsApplied(db: Db, names: readonly string[]): Promise<void> {
  const records = db.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
  const appliedAt = nowTimestamp();

  for (const name of names) {
    await records.updateOne({ _id: name }, { $setOnInsert: { applied_at: appliedAt } }, { upsert: true });
  }
}
