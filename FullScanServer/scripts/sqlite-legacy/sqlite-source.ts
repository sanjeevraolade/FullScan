import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { LEGACY_TABLE_NAMES, type LegacyTableName } from '../../src/db/schema.js';

/**
 * Reads the pre-MongoDB SQLite database. Used only by the migration tooling:
 * `generate-mongo-seed.ts` (builds a fresh database from the SQL migrations and
 * snapshots it as the MongoDB seed) and `migrate-sqlite-to-mongo.ts` (copies an
 * existing database file into MongoDB).
 */

/** The 22 SQL migrations, kept as history and as the source of the seed snapshot. */
export const LEGACY_MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export type SqliteRow = Record<string, unknown>;

/**
 * Applies any legacy SQL migration the database has not had yet, in filename order —
 * exactly what the old `initDb()` did — so every table is in its final shape before
 * it is read.
 */
export function applyLegacyMigrations(db: Database.Database): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM migrations').all() as { name: string }[]).map((row) => row.name),
  );
  const pending = fs
    .readdirSync(LEGACY_MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql') && !applied.has(file))
    .sort();

  for (const file of pending) {
    db.exec(fs.readFileSync(path.join(LEGACY_MIGRATIONS_DIR, file), 'utf-8'));
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
  }

  return pending;
}

/**
 * Every business table, rows in insertion (`rowid`) order. Collections added after the
 * move to MongoDB (e.g. `app_metadata`) have no table here and are not read.
 */
export function readAllTables(db: Database.Database): Record<LegacyTableName, SqliteRow[]> {
  return Object.fromEntries(
    LEGACY_TABLE_NAMES.map((name) => [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all() as SqliteRow[]]),
  ) as Record<LegacyTableName, SqliteRow[]>;
}
