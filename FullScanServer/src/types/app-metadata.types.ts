/** `_id` of the `app_metadata` document that holds the master-data version. */
export const MASTER_DATA_METADATA_ID = 'master_data';

/** An `app_metadata` document: one server-maintained value about the data, keyed by name. */
export interface AppMetadataDocument {
  readonly _id: string;
  /** ISO 8601 UTC with milliseconds (`nowIsoTimestamp()`), e.g. `2026-10-04T09:15:02.481Z`. */
  readonly updated_at: string;
}
