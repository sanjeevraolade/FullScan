/**
 * One-time copy of an existing SQLite database into MongoDB — for keeping the data
 * a running dev server built up (device bindings, device change requests, mock
 * location detections, evidence records, admin edits) instead of starting over from
 * the seed.
 *
 * Usage: npm run db:migrate-sqlite -- [--sqlite ./data/fullscan.sqlite] [--drop]
 *
 * - Reads a snapshot of the SQLite file (`.backup()`), so the source is never
 *   modified, and brings the snapshot up to date with any legacy SQL migration it
 *   is missing.
 * - Refuses to write into a MongoDB database that already holds data, unless
 *   `--drop` is passed — then the FullScan collections are dropped first.
 * - Marks the seed migration as applied, since the copied data already contains it.
 * - Checks every collection's document count against its table's row count.
 *
 * Target: MONGODB_URI / MONGODB_DB, as for the server.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { MongoClient, type Db } from 'mongodb';
import { getMongoConfig, redactUri } from '../src/db/connection.js';
import { recordMigrationsApplied } from '../src/db/migrations/index.js';
import { seedInitialData } from '../src/db/migrations/001_seed_initial_data.js';
import { applySchema, COLLECTION_NAMES, MIGRATIONS_COLLECTION, toDocument } from '../src/db/schema.js';
import { applyLegacyMigrations, readAllTables } from './sqlite-legacy/sqlite-source.js';

dotenv.config();

const INSERT_BATCH_SIZE = 1000;

interface Options {
  readonly sqlitePath: string;
  readonly shouldDrop: boolean;
}

function readOptions(argv: readonly string[]): Options {
  const sqliteFlag = argv.indexOf('--sqlite');

  return {
    sqlitePath: path.resolve(
      sqliteFlag >= 0 && argv[sqliteFlag + 1] ? argv[sqliteFlag + 1] : process.env.DB_PATH || './data/fullscan.sqlite',
    ),
    shouldDrop: argv.includes('--drop'),
  };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function readSqliteSnapshot(sqlitePath: string) {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }

  const snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fullscan-sqlite-snapshot-'));
  const snapshotPath = path.join(snapshotDir, 'snapshot.sqlite');

  try {
    const source = new Database(sqlitePath, { readonly: true, fileMustExist: true });
    await source.backup(snapshotPath);
    source.close();

    const snapshot = new Database(snapshotPath);
    snapshot.pragma('foreign_keys = ON');
    const upgradedWith = applyLegacyMigrations(snapshot);
    const tables = readAllTables(snapshot);
    snapshot.close();

    return { tables, upgradedWith };
  } finally {
    fs.rmSync(snapshotDir, { recursive: true, force: true });
  }
}

async function findPopulatedCollections(db: Db): Promise<string[]> {
  const populated: string[] = [];

  for (const name of [...COLLECTION_NAMES, MIGRATIONS_COLLECTION]) {
    if ((await db.collection(name).estimatedDocumentCount()) > 0) {
      populated.push(name);
    }
  }

  return populated;
}

async function dropFullScanCollections(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const name of [...COLLECTION_NAMES, MIGRATIONS_COLLECTION]) {
    if (existing.has(name)) {
      await db.collection(name).drop();
    }
  }
}

async function migrate({ sqlitePath, shouldDrop }: Options): Promise<void> {
  log(`Reading ${sqlitePath}`);
  const { tables, upgradedWith } = await readSqliteSnapshot(sqlitePath);

  if (upgradedWith.length > 0) {
    log(`Applied ${upgradedWith.length} pending legacy SQL migration(s) to the snapshot: ${upgradedWith.join(', ')}`);
  }

  const { uri, dbName } = getMongoConfig();
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    log(`Writing to ${dbName} at ${redactUri(uri)}`);

    const populated = await findPopulatedCollections(db);
    if (populated.length > 0) {
      if (!shouldDrop) {
        throw new Error(
          `MongoDB database "${dbName}" already has data in: ${populated.join(', ')}. ` +
            'Re-run with --drop to replace it.',
        );
      }
      log(`Dropping existing collections: ${populated.join(', ')}`);
      await dropFullScanCollections(db);
    }

    await applySchema(db);

    for (const name of COLLECTION_NAMES) {
      const documents = tables[name].map((row) => toDocument(name, row));

      for (let start = 0; start < documents.length; start += INSERT_BATCH_SIZE) {
        await db.collection(name).insertMany(documents.slice(start, start + INSERT_BATCH_SIZE), { ordered: true });
      }
    }

    // The copied tables already hold everything the seed migration would insert.
    await recordMigrationsApplied(db, [seedInitialData.name]);

    let hasMismatch = false;
    log('\nCollection                 SQLite rows   MongoDB docs');

    for (const name of COLLECTION_NAMES) {
      const copied = await db.collection(name).countDocuments();
      const expected = tables[name].length;
      hasMismatch ||= copied !== expected;
      log(`${name.padEnd(26)} ${String(expected).padStart(11)}   ${String(copied).padStart(12)}${copied === expected ? '' : '  MISMATCH'}`);
    }

    if (hasMismatch) {
      throw new Error('Document counts do not match the SQLite row counts');
    }

    log('\nDone. Start the server with MONGODB_URI / MONGODB_DB pointing at this database.');
  } finally {
    await client.close();
  }
}

migrate(readOptions(process.argv.slice(2))).catch((err: unknown) => {
  process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
