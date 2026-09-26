import fs from 'fs';
import path from 'path';
import type { ClientSession, Db } from 'mongodb';
import { COLLECTION_NAMES, toDocument } from '../schema.js';
import { nowTimestamp } from '../timestamp.js';
import type { Migration } from './index.js';

/**
 * Seeds a new, empty database with the data the 22 SQLite migrations used to create:
 * field executives, cases and components, dropdown options, admin users, mobile app
 * settings and UI configs.
 *
 * The rows live in `src/db/seed/<collection>.json`, generated from those SQL files by
 * `npm run db:generate-seed` — regenerate them rather than editing by hand.
 */

const SEED_DIR = path.join(__dirname, '..', 'seed');

/**
 * Stands in for a `datetime('now')` default in the seed files. Replaced with the time
 * of seeding, so a new database is stamped when it was created — as under SQLite.
 */
export const SEED_NOW = '__SEED_NOW__';

type SeedRow = Readonly<Record<string, unknown>>;

function readSeedRows(fileName: string): SeedRow[] {
  const filePath = path.join(SEED_DIR, fileName);
  return fs.existsSync(filePath) ? (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SeedRow[]) : [];
}

function stampSeedTime(row: SeedRow, now: string): SeedRow {
  return Object.fromEntries(Object.entries(row).map(([field, value]) => [field, value === SEED_NOW ? now : value]));
}

export const seedInitialData: Migration = {
  name: '001_seed_initial_data',

  async up(db: Db, session: ClientSession): Promise<void> {
    const now = nowTimestamp();

    for (const name of COLLECTION_NAMES) {
      const rows = readSeedRows(`${name}.json`);

      if (rows.length > 0) {
        await db
          .collection(name)
          .insertMany(rows.map((row) => toDocument(name, stampSeedTime(row, now))), { session });
      }
    }
  },
};
