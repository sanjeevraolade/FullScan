/**
 * Regenerates the MongoDB seed (`src/db/seed/<collection>.json`) from the legacy SQL
 * migrations: builds a fresh in-memory SQLite database from all of them, then writes
 * each non-empty table out as a JSON array, rows in insertion order.
 *
 * Timestamps the build itself stamped (`datetime('now')` defaults) are written as
 * the `__SEED_NOW__` placeholder, which the seed migration replaces with the time a
 * database is seeded.
 *
 * Usage: npm run db:generate-seed
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { SEED_NOW } from '../src/db/migrations/001_seed_initial_data.js';
import { LEGACY_TABLE_NAMES } from '../src/db/schema.js';
import { nowTimestamp } from '../src/db/timestamp.js';
import { applyLegacyMigrations, readAllTables, type SqliteRow } from './sqlite-legacy/sqlite-source.js';

const SEED_DIR = path.join(__dirname, '..', 'src', 'db', 'seed');

function replaceBuildTimestamps(row: SqliteRow, buildStartedAt: string, buildFinishedAt: string): SqliteRow {
  return Object.fromEntries(
    Object.entries(row).map(([field, value]) => [
      field,
      typeof value === 'string' && value >= buildStartedAt && value <= buildFinishedAt ? SEED_NOW : value,
    ]),
  );
}

function generateSeed(): void {
  const buildStartedAt = nowTimestamp();
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const applied = applyLegacyMigrations(db);
  const buildFinishedAt = nowTimestamp();
  const tables = readAllTables(db);
  db.close();

  fs.mkdirSync(SEED_DIR, { recursive: true });

  // Only the SQLite-backed collections: MongoDB-only ones are populated by migrations.
  for (const name of LEGACY_TABLE_NAMES) {
    const filePath = path.join(SEED_DIR, `${name}.json`);
    const rows = tables[name].map((row) => replaceBuildTimestamps(row, buildStartedAt, buildFinishedAt));

    if (rows.length === 0) {
      fs.rmSync(filePath, { force: true });
      continue;
    }

    fs.writeFileSync(filePath, `${JSON.stringify(rows, null, 2)}\n`);
    process.stdout.write(`${name}: ${rows.length} rows\n`);
  }

  process.stdout.write(`Seed generated from ${applied.length} SQL migrations into ${SEED_DIR}\n`);
}

generateSeed();
