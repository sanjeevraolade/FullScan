import type { ClientSession, Db } from 'mongodb';
import { nowIsoTimestamp } from '../timestamp.js';
import { MASTER_DATA_METADATA_ID, type AppMetadataDocument } from '../../types/app-metadata.types.js';

/**
 * Sets the master-data version to now, creating it if missing — the migration-side
 * twin of `bumpMasterDataUpdatedAt()` in `app-metadata.dao.ts`. Migrations run with an
 * explicit `db` and `session` rather than under `runInTransaction`, so they call this.
 *
 * Required in every migration that inserts, updates or deletes `dropdown_options` or
 * `mobile_app_settings` rows, or changes the master-data payload shape (see
 * `MIGRATIONS`). Pass the migration's `session` so the bump commits with its changes.
 */
export async function bumpMasterDataVersion(db: Db, session: ClientSession): Promise<void> {
  await db
    .collection<AppMetadataDocument>('app_metadata')
    .updateOne(
      { _id: MASTER_DATA_METADATA_ID },
      { $set: { updated_at: nowIsoTimestamp() } },
      { upsert: true, session },
    );
}
