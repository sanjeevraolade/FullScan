import { getCollection, sessionOption } from './connection.js';
import { nowIsoTimestamp } from './timestamp.js';
import { MASTER_DATA_METADATA_ID, type AppMetadataDocument } from '../types/app-metadata.types.js';

/**
 * The master-data version: the `app_metadata` document `master_data`, whose
 * `updated_at` changes whenever master data (dropdown options or mobile app settings)
 * changes. Login and `GET /master-data` return it, and the mobile app re-downloads
 * master data only when it differs from the copy it holds. The app compares it for
 * equality only, so any new value means "changed".
 *
 * Bumped by every write to master data: `updateMobileAppSettings()` in the same
 * transaction as the settings, and migrations through `bumpMasterDataVersion()` in
 * `migrations/master-data-version.ts`.
 */

function appMetadata() {
  return getCollection<AppMetadataDocument>('app_metadata');
}

/** The current master-data version, or `null` when none is recorded. Never writes. */
export async function findMasterDataUpdatedAt(): Promise<string | null> {
  const document = await appMetadata().findOne(
    { _id: MASTER_DATA_METADATA_ID },
    { projection: { updated_at: 1 }, ...sessionOption() },
  );

  return document?.updated_at ?? null;
}

/**
 * Sets the master-data version to now, creating the document if it is missing.
 * Call it inside the `runInTransaction` that writes the master data, so the data and
 * its version commit or roll back together.
 */
export async function bumpMasterDataUpdatedAt(): Promise<void> {
  await appMetadata().updateOne(
    { _id: MASTER_DATA_METADATA_ID },
    { $set: { updated_at: nowIsoTimestamp() } },
    { upsert: true, ...sessionOption() },
  );
}
